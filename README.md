# OpenTok Call Center Demo

This demo showcases a simulation of call center where callers queue up to talk to available agents using OpenTok.

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/kaustavdm/opentok-call-center-demo)

## OpenTok features used

These are the OpenTok features used in this demo:

- Server-side SDK (NodeJS): Used to created dynamic session and token creation per call
- Publish and subscribe streams: For connecting agent with caller
- Signaling - To signal for agent join, call hold and call resume.
- Session monitoring - To keep active caller list updated

## Install

Install NodeJS v8.0+

Install dependencies with `npm`

```sh
$ npm install
```

Get OpenTok API keys and set them as environment variables:

```sh
$ export OPENTOK_API_KEY="opentok-api-key-here"
$ export OPENTOK_API_SECRET="opentok-api-secret-here"
```

**Register session monitoring callback** in your [TokBox account](https://tokbox.com/account) for the path `/ot_callback`. For example, if this application is hosted at `https://example.com`, register this URL: `https://example.com/ot_callback`.

Build assets for the app, run:

```sh
$ npm run app-build
```

### Start the server

```sh
$ npm start
```

This will start the application on port `8080`. To change port, set the `PORT` environment variable. For example, to start the application on port `3000`, do this:

```sh
$ PORT=3000 npm start
```

To start secure server, set the `SECURE` environment variable to some value. For example, this will start the application on HTTPS port 3000:

```sh
$ SECURE=1 PORT=3000 npm start
```

### Development use

For development use, you can compile assets in development mode and launch server by running:

```sh
$ npm run dev
```

## Walkthrough

This application builds a simple queue where callers can wait for agents to talk to them. It uses NodeJS as the backend and VueJS in the frontend.

Note: The server stores all data in-memory for the purpose of this demo. A real-world application should use some database instead.

### Application flow

#### Callers

- Callers provide their name and reason for call when joining. They can also select whether they want to join as audio-only or using both audio and video.
- Once callers have joined, they wait in queue till an agent joins that call.
- Callers remain connected when they have been put on hold or if agent has disconnected.
- Callers can decide to exit the call at any time.
- Callers exit if agent triggers call end.

#### Agents

- Agents join and wait for callers to be available.
- Each agent can be assigned multiple callers. Assignment is done using least connections strategy - when a new caller joins, the caller is assigned to the agent with least number of assigned callers.
- When a caller is assigned to agent, agent's caller list is updated.
- Agent can join one caller at a time.
- Agent can put an existing caller on hold to join another caller.
- Agent can resume a call.
- Agent can end the call they are connected to. This will make the caller exit as well.
- Agent can switch between callers that agent has been assigned. If agent switches to another caller, then the current caller is put on hold.

### Server

Backend logic for this demo is present in [**server.js**](server.js). These are what the server does:

- Call OpenTok REST API using the [OpenTok Node SDK](https://tokbox.com/developer/sdks/node/).
- Create functions to generate OpenTok sessions and tokens.
- Define `Caller` constructor used to represent a caller and provide methods to perform actions on each caller.
- Define `Agent` constructor used to represent an agent and provide methods to perform actions on each agent.
- Manage pending callers queue - A list of callers who are yet to be assigned to any agent.
- Perform assignment of callers to available agents.
- Send [signals through the OpenTok REST API](https://tokbox.com/developer/guides/signaling/rest/) to coordinate interactions between agent and caller.
- Handle OpenTok session monitoring callbacks for connection created and connection destroyed events. This is used to keep track of when callers are ready to join agents and when they have left.
- Provides HTTP interfaces for frontend to communicate, with endpoints for agents and callers.

### Frontend

The frotend is a simple single-page application (SPA) built on VueJS with vue-router to route between agent and caller screens. It uses UIKit for drawing the UI. The demo intentionally keeps things simple without breaking down code into further components or customizing much of the UI elements.

These are the relevant files:

- [`app.js`](app.js): Bootstrapping script that loads vue and vue-router and mounts routes from the components.
- [`components/`](components): Directory where all vue components are stored
  - [`components/home.vue`](components/home.vue): Template for the homepage of the demo
  - [`components/caller.vue`](components/caller.vue): Component used for the caller screen. This sets up the caller's initial form and then manages the whole lifecycle of the caller.
  - [`components/agent.vue`](components/agent.vue): Component used for the agent screen. This manages entire lifecycle of the agent.
  - [`components/ot-publisher.vue`](components/ot-publisher.vue) and [`components/ot-subscriber.vue`](components/ot-subscriber.vue) provide reusable components for OpenTok publisher and subscriber objects.

### Call queue management

A core part of this demo is managing caller queue and assigning callers to agents. All of this happens on the server side in `server.js`. It uses OpenTok's session monitoring to reliably determine when a caller has connected or disconnected.

Call queue management is composed of four main pieces:

- `pendingQueue[]`: An array that stores callers who are yet to be assigned to any agent.
- `assignCaller(caller)`: A function that takes a `Caller` instance as argument and assigns it to an agent.
- `agent.assignPending(limit = 1)`: A method on `Agent` that assigns a number of callers from `pendingQueue[]` to given agent in FIFO mode - callers who were in the queue earlier are assigned first.
- `removeCaller(callerID)`: A function that removes a caller from list of active callers and also from `pendingQueue[]`.
