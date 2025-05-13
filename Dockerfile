FROM node:slim

# https://github.com/opencontainers/image-spec/blob/main/annotations.md
LABEL org.opencontainers.image.title="Rescue Shelter Secure Services"
LABEL org.opencontainers.image.url="https://githhub.com/kscott5/rescueshelter.services"
LABEL org.opencontainers.image.source="https://githhub.com/kscott5/rescueshelter.services"
LABEL org.opencontainers.image.version="v2.0.1"
  
EXPOSE 3303

RUN export RS_CONNETION_URI="mongodb+srv://cluster0.dol02bo.mongodb.net/?authSource=%24external&authMechanism=MONGODB-X509&retryWrites=true&tlsCertificateKeyFile=/app/cert/production.perm&w=majority&appName=Cluster0&dbname=rescueshelter"

RUN mkdir /app
RUN mkdir /app/cert

COPY ./dist/** /app
WORKDIR /app

ENTRYPOINT [ "node", "index.js" ]