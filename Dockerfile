FROM coaxist-pms-base

RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install -y \
		fuse3 \
		p7zip-full \
		;
RUN curl https://rclone.org/install.sh | bash

COPY root/ /

ENTRYPOINT ["/bin/bash"]
