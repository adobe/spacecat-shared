SELECT 
  user_agent,
  status,
  {{weekColumns}}
FROM {{databaseName}}.{{tableName}}
{{whereClause}}
GROUP BY user_agent, status
ORDER BY {{orderBy}} DESC
LIMIT 1000
