-- SQL file to set max_connections
SET GLOBAL max_connections = 200;
-- To make persistent, add `max_connections=200` under [mysqld] in my.cnf/my.ini and restart the server.
