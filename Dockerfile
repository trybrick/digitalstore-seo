FROM brickinc/digitalstore-seo:1.1.5
COPY ./app/lib/stripHtml.js /usr/src/app/lib/
RUN cd /usr/src/app;
CMD [ "npm", "start" ]
