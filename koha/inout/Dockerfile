FROM php:8.2-apache

RUN docker-php-ext-install mysqli \
 && a2enmod rewrite

ARG INOUT_REF=v6
ADD https://github.com/omkar2403/inout/archive/refs/tags/${INOUT_REF}.tar.gz /tmp/inout.tar.gz

RUN tar -xzf /tmp/inout.tar.gz -C /tmp \
 && rm -rf /var/www/html/* \
 && mv /tmp/inout-6/* /var/www/html/ \
 && rm -rf /tmp/inout.tar.gz /tmp/inout-6 \
 && sed -i 's|/inout/dash.php|/dash.php|g' /var/www/html/dash.php \
 && chown -R www-data:www-data /var/www/html

COPY dbconn.php /var/www/html/functions/dbconn.php
COPY overlay/dash.php /var/www/html/dash.php
COPY overlay/login.php /var/www/html/login.php
COPY overlay/main.php /var/www/html/process/operations/main.php
COPY overlay/stats.php /var/www/html/process/operations/stats.php
COPY overlay/dbc-inout.css /var/www/html/assets/css/dbc-inout.css
COPY overlay/dbc-login.css /var/www/html/assets/css/dbc-login.css
COPY overlay/dbc-logo.png /var/www/html/assets/img/dbc-logo.png
COPY overlay/dbc-crest.png /var/www/html/assets/img/dbc-crest.png
COPY overlay/campus.jpg /var/www/html/assets/img/campus.jpg
COPY overlay/don-bosco.png /var/www/html/assets/img/don-bosco.png
COPY apache-php-env.conf /etc/apache2/conf-enabled/inout-env.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
