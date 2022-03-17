FROM debian:buster
RUN apt-get update && apt-get install -y nodejs git wget build-essential python fonts-dejavu libboost-filesystem-dev libboost-regex-dev libboost-system-dev libcairo2-dev libfreetype6-dev libgdal-dev libharfbuzz-dev libjpeg-dev libpng-dev libpq-dev libproj-dev libtiff-dev libwebp-dev libxml2-dev libmapbox-variant-dev libboost-program-options-dev libboost-thread-dev libmapnik-dev mapnik-utils mapnik-doc libmapnik3.0 && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /usr/local/nvm
ENV NVM_DIR /usr/local/nvm
RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash && . $NVM_DIR/nvm.sh && nvm install 10.15.2
RUN groupadd -o -g 1000 -r rungroup && useradd -o -m -r -g rungroup -u 1000 runuser
USER runuser
ENV HOME=/home/runuser LINK=g++
ENV IN_DOCKER=1
CMD  . $NVM_DIR/nvm.sh && nvm use 10.15.2 && npm install --production --build-from-source=@kartotherian/mapnik  