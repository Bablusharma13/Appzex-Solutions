-- Runs once when the MySQL volume is first created.
-- The dev user needs CREATE DATABASE rights because `prisma migrate dev`
-- creates a temporary shadow database. The test suite uses its own database.
CREATE DATABASE IF NOT EXISTS appzex_test;
GRANT ALL PRIVILEGES ON *.* TO 'appzex'@'%';
FLUSH PRIVILEGES;
