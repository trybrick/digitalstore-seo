FROM node:24
EXPOSE 3000
RUN apt-get update && apt-get upgrade -y \
    && apt-get install nano \
    && mkdir -p /usr/src/app/lib \
    && groupadd -r prerender && useradd -r -g prerender -d /usr/src/app prerender \
    && chown prerender:prerender /usr/src/app \
    && apt-get clean -y && apt-get autoclean -y \
    && apt-get autoremove --purge -y \
    && rm -rf /var/lib/apt/lists/* /var/lib/log/* /tmp/* /var/tmp/*
USER prerender
COPY ./app/ /usr/src/app/
WORKDIR /usr/src/app
RUN cd /usr/src/app
RUN npm install
CMD [ "npm", "start" ]