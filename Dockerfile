FROM node:8
LABEL maintainer="tnguyen@trybrick.com"
ENV NPM_CONFIG_LOGLEVEL warn
EXPOSE 3000
RUN apt-get update && apt-get upgrade -y \
    && mkdir -p /usr/src/app/lib \
    && groupadd -r prerender && useradd -r -g prerender -d /usr/src/app prerender \
    && chown prerender:prerender /usr/src/app \
    && apt-get clean -y && apt-get autoclean -y \
    && apt-get autoremove --purge -y \
    && rm -rf /var/lib/apt/lists/* /var/lib/log/* /tmp/* /var/tmp/*
USER prerender
COPY ./app/ /usr/src/app/
WORKDIR /usr/src/app
RUN cd /usr/src/app; npm install --production
CMD [ "npm", "start" ]
