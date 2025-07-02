SELECT 
  url,
  status,
  {{weekColumns}}
FROM {{databaseName}}.{{tableName}}
{{whereClause}}
GROUP BY url, status
ORDER BY {{orderBy}} DESC
LIMIT 1000
