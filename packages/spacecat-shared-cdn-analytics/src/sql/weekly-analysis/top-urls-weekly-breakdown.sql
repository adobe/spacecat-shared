SELECT 
  url,
  {{weekColumns}}
FROM {{databaseName}}.{{tableName}}
{{whereClause}}
GROUP BY url
ORDER BY {{orderBy}} DESC
LIMIT 1000
