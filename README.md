# Test (micro)Service App
This application have a general schema of how Services can be combined and managed using latest JavaScript techs.


## Install
1. Install [Nginx](http://nginx.org/en/docs/install.html)
2. Install [Redis](http://redis.io/topics/quickstart)
3. Install project
  ```
  git clone https://github.com/IvanDimanov/test_microservice_app.git
  cd test_microservice_app
  npm run initial-build
  sudo npm start
  ```
*NOTE:* Application needs *Admin* (sudo) privileges in order to manipulate *Nginx* daemon.

4. Take a peak at your configuration in `node_modules/custom/config/default_config.json`


## Back-end
Platform composition is based on the methodology of *pm2* organized instances, communicating over *Redis*, that are been manager through *Nginx* network layer.
- `manager/instance-manager` - using *pm2* to secure instances creation, redundancy, standard screen logs, and destruction
- `manager/nginx-manager` - combine all Services into clusters of *Load-Balances* within limited access network
- `manager/stats-manager` - using *Redis* to help with collecting *Real-time stats* for all running Services
- `manager/index.js` - orchestrate the dynamic *Service creation* and management; aggregating *Service stats* with *Redis*; exposes *Socket API* used from the *Front-end*


## Front-end
A *React.js* app is been available on `http://localhost/manager`. It serves as *Main management panel*
that consists of *2 tabs*, organized with focus on *Real-time stats* and *Services Composition*.


### Tab: Instances Types Stats
Here each Service Type will have 2 distinctive charts, presenting the entire group statistics.
The line chart presents the *Average Response time* while the bar chart presents the *Number of Responses* each Service Group made in a time period.

![Instance Stats Charts](https://raw.githubusercontent.com/IvanDimanov/test_microservice_app/master/notes/charts.png)

Clicking on the [+] Button will open a pop-up where user can manage the *Total Number of Services* for each Service Type.
As shown on the graphic, increasing the number of Services - decreases the *Average Response time* and increases the *Number of Responses* for the entire Service Type Group.


### Tab: Group Services Stats
This tab presents a complete connection setup of all tunning *Services*. Graph is been generated using [sigma.js](https://github.com/jacomyal/sigma.js)

![Services Graph](https://raw.githubusercontent.com/IvanDimanov/test_microservice_app/master/notes/graph.png)

In this graph each *Instance Service* is presented as "leaf" - connected to its *Service Type Group*.
The *size* of each *node* presents now many *Responses* it served while its *color* shows their *Average Response time*.


## Contribution
Please be advised that this repo is only an *example* of how *Node.js* can both create *(micro)Services* and manage them using latest tech stack of: *Nginx*, *Redis* and *pm2*.
Hence, this schema is meant only to *inspire* architectural solutions and *not* to be put in production as it is.
