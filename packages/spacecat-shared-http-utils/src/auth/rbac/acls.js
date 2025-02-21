/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

function prepPathForSort(path) {
  if (path.endsWith('/+**')) return path.slice(0, -3);
  if (path.endsWith('/**')) return path.slice(0, -2);
  return path;
}

function pathSorter({ path: path1 }, { path: path2 }) {
  const sp1 = prepPathForSort(path1);
  const sp2 = prepPathForSort(path2);
  return sp2.length - sp1.length;
}

export async function getDBAcls(dynamoClient, orgId, roles) {
  const input = {
    ExpressionAttributeNames: {
      '#role': 'role',
    },
    ExpressionAttributeValues: {
      ':orgid': {
        S: orgId,
      },
    },
    KeyConditionExpression: 'imsorgid = :orgid',
    ProjectionExpression: 'acl, #role',
    TableName: 'spacecat-services-acls-dev6',
  };

  const feRoles = [];
  let i = 0;
  for (const role of roles) {
    const roleID = `:role${i}`;
    feRoles.push(roleID);
    input.ExpressionAttributeValues[roleID] = {
      S: role,
    };
    i += 1;
  }
  input.FilterExpression = `#role IN (${feRoles.join(', ')})`;

  console.log('§§§ Get DBACLs input:', JSON.stringify(input));
  const command = new QueryCommand(input);
  const resp = await dynamoClient.send(command);
  console.log('§§§ DynamoDB Get DBACLs response:', JSON.stringify(resp));

  // TODO sort paths by length

  const acls = resp.Items.map((it) => ({
    role: it.role.S,
    acl: it.acl.L.map((a) => ({
      path: a.M.path.S,
      actions: a.M.actions.SS,
    })),
  }));

  acls.forEach((it) => it.acl.sort(pathSorter));
  return acls;
}

export async function getDBRoles(dbClient, {
  imsUserId, imsOrgId, imsGroups, apiKey,
}) {
  const idents = {
    ':userident': {
      S: `imsID:${imsUserId}`,
    },
    ':orgident': {
      S: `imsOrgID:${imsOrgId}`,
    },
  };

  if (imsGroups) {
    for (const [org, groups] of Object.entries(imsGroups)) {
      if (!(org.split('@')[0] === imsOrgId)) {
        // eslint-disable-next-line no-continue
        continue;
      }

      let grpCnt = 0;
      for (const group of groups.groups) {
        idents[`:grp${grpCnt}`] = {
          S: `imsOrgID/groupID:${imsOrgId}/${group.groupid}`,
        };
        grpCnt += 1;
      }
    }
  }

  if (apiKey) {
    idents[':apikey'] = {
      S: `apiKeyID:${apiKey}`,
    };
  }

  const input = {
    ExpressionAttributeNames: {
      '#roles': 'roles',
    },
    ExpressionAttributeValues: {
      ':orgid': {
        S: imsOrgId,
      },
      ...idents,
    },
    KeyConditionExpression: 'orgid = :orgid',
    FilterExpression: `identifier IN (${Object.keys(idents).join(', ')})`,
    ProjectionExpression: '#roles',
    TableName: 'spacecat-services-roles-dev4',
  };

  console.log('§§§ Get roles input:', JSON.stringify(input));
  const command = new QueryCommand(input);
  const resp = await dbClient.send(command);
  console.log('§§§ DynamoDB getRoles response:', JSON.stringify(resp));

  const roles = resp.Items.flatMap((item) => item.roles.SS);
  return new Set(roles);
}

export default async function getAcls({
  imsUserId, imsOrgs, imsGroups, apiKey,
}) {
  console.log('§§§ getAcls input:', JSON.stringify({
    imsUserId, imsOrgs, imsGroups, apiKey,
  }));
  const dbClient = new DynamoDBClient();

  const acls = [];
  // Generally there is only 1 organization, but the API returns an array so
  // we'll iterate over it and use all the ACLs we find.
  for (const orgid of imsOrgs) {
    const imsOrgId = orgid.split('@')[0];
    // eslint-disable-next-line no-await-in-loop
    const roles = await getDBRoles(dbClient, {
      imsUserId, imsOrgId, imsGroups, apiKey,
    });
    if (roles === undefined || roles.size === 0) {
      // eslint-disable-next-line no-continue
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const aclList = await getDBAcls(dbClient, imsOrgId, roles);
    acls.push(...aclList);
  }

  return {
    acls,
    aclEntities: {
      model: ['organization', 'site'],
    },
  };
}
