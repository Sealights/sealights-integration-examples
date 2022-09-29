#!/bin/bash

echo "### Package New Reporter"
npm pack

echo "### Install New Reporter..."
#npm install -g newman-reporter-sealights.0.0.2.tgz
sudo npm install --prefer-offline --no-audit -g newman-reporter-sealights-0.0.2.tgz
#sudo npm install --prefer-offline --no-audit newman-reporter-sealights-0.0.1.tgz

echo "### Ready"