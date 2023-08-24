FROM ubuntu:jammy

# https://downloads.plex.tv/plex-media-server-new/1.32.5.7349-8f4248874/debian/plexmediaserver_1.32.5.7349-8f4248874_i386.deb
# https://downloads.plex.tv/plex-media-server-new/1.32.5.7349-8f4248874/debian/plexmediaserver_1.32.5.7349-8f4248874_amd64.deb
# https://downloads.plex.tv/plex-media-server-new/1.32.5.7349-8f4248874/debian/plexmediaserver_1.32.5.7349-8f4248874_arm64.deb
# https://downloads.plex.tv/plex-media-server-new/1.32.5.7349-8f4248874/debian/plexmediaserver_1.32.5.7349-8f4248874_armhf.deb
# https://downloads.plex.tv/plex-media-server-new/1.32.5.7349-8f4248874/redhat/plexmediaserver-1.32.5.7349-8f4248874.i686.rpm
# https://downloads.plex.tv/plex-media-server-new/1.32.5.7349-8f4248874/redhat/plexmediaserver-1.32.5.7349-8f4248874.x86_64.rpm

RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install -y curl gnupg2

RUN echo deb https://downloads.plex.tv/repo/deb public main | tee /etc/apt/sources.list.d/plexmediaserver.list
RUN curl https://downloads.plex.tv/plex-keys/PlexSign.key | apt-key add -
RUN apt-get update
RUN apt-get install -y plexmediaserver

RUN useradd -m -s /bin/bash plex
RUN usermod -aG sudo plex
RUN echo "plex:plex" | chpasswd

RUN mkdir -p /home/plex
RUN chown -R plex:plex /home/plex

# USER plex
