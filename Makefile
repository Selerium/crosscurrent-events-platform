all:
	mkdir -p data
	docker compose up -d --build

clean:
	docker compose down


fclean: clean
	rm -rf data
