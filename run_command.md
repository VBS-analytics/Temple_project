docker compose -p temple_dev up --build



docker exec -it temple_dev-db-1 psql -U temple_user -d temple_db