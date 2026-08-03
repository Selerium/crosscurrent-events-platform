FROM nginx:alpine

RUN apk add --no-cache certbot openssl

COPY default.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh && mkdir -p /var/www/certbot

EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]
