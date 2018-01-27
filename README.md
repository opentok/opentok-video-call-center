# OpenTok Call Center Demo

This demo showcases a simulation of call center where callers queue up to talk to available agents using OpenTok.

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/opentok/opentok-video-call-center)

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

#### Agent screen

The agent screen has all the magic in this demo. Here is how agent screen handles callers in the frotnend:

1. Each caller uses a different OpenTok session.
2. When agent wants to join a caller, the frontend retrieves a token for the agent for the session of that caller. Then, it connects agent to that session, publishes agent stream and subscribes to existing caller stream.
3. When agent wants to put a caller on hold, agent unpublishes their stream and disconnects from the session.
4. When agent wants to resume talking to a caller they have put on hold, step 2 is repeated.

So, the agent keeps on switching between OpenTok sessions - connecting to them and disconnecting as required. This whole process takes a reasonably short time. At each stage, the application sends out signals for each event so that the client UI can adjust accordingly.

### Call queue management

A core part of this demo is managing caller queue and assigning callers to agents. All of this happens on the server side in `server.js`. It uses OpenTok's session monitoring to reliably determine when a caller has connected or disconnected.

Call queue management is composed of six main pieces:

- `callers[]`: List of current callers. This is a `Map` that uses caller ID as key and its corresponding `Caller` instance as the value.
- `agents[]`: List of active agents. This is another `Map` that uses agent ID as key and its corresponding `Agent` instance as the value.
- `pendingQueue[]`: An array that stores callers (instances of `Caller`) who are yet to be assigned to any agent.
- `assignCaller(caller)`: A function that takes a `Caller` instance as argument and assigns it to an agent. If no agent is connected, this function adds the given caller to `pendingQueue[]`.
- `agent.assignPending(limit = 1)`: A method on `Agent` that assigns a number of callers from `pendingQueue[]` to given agent in FIFO mode - callers who were in the queue earlier are assigned first.
- `removeCaller(callerID)`: A function that removes a caller from list of active callers and also from `pendingQueue[]`.

Here is a step-by-step description of how the call queue logic is handled:

1. When a caller connects to the application, the caller screen access the HTTP endpoint at `GET /dial`.
    - This creates a new instance of the `Caller` constructor by calling `new Caller()` based on the caller's supplied details - name, reason and whether the call is audio-only
    - The caller is initial marked as not ready.
    - Then, it tries to assign the caller to an agent by calling `assignCaller(caller)`.
    - Then, it creates a new OpenTok session and token for this caller and sends out a response with the caller status.
2. The caller screen on the frontend then uses this information to connect to the given OpenTok session and starts publishing the caller's stream.
3. The server listens to OpenTok session monitoring callbacks in the HTTP endpoint `POST /ot_callback`.
   - When a caller connects to the session, OpenTok posts data with caller's connection information to this endpoint. The endpoint calls the `handleConnectionCreated()` handler to match the connection data with the caller ID and marks the caller as ready.
   - Similarly, when a caller disconnects from OpenTok, OpenTok posts the caller's connection information. Then, the endpoint cleans up the caller info by calling `removeCaller(callerID)`.
4. When an agent joins, the agent interface calls the HTTP endpoint at `POST /agent`.
    - This creates a new instance of the `Agent` constructor.
    - Then it attempts to assign first 3 pending callers by calling `agent.assignPending(3)`.
    - Then it returns the agent ID.
5. The agent screen then keeps on polling the list of callers assigned to the current agent by hitting the HTTP endpoint at `/agent/:id/callers`.
    - This attempts to assign the first caller in the `pendingQueue[]` by calling `agent.assignPending(1)` if the agent has less than 3 callers assigned at that point.
    - Then it returns list of currently assigned callers who are marked as ready (see step 3 above). This ensures that the agent screen only sees list of callers who are currently connected to OpenTok.
6. When a caller needs to be removed, then frontend calls the HTTP endpoint at `GET /call/:id/delete`. This calls `removeCaller(callerID)` internally. The frontend can call this HTTP endpoint when any of these events happen:
    - Caller ends call by clicking "End call" button in the caller's screen
    - Agent ends current call by clicking "End call" button in the agent's screen
    - Caller closes their browser window when call is ongoing
7. When agent exits, either by closing their browser window or by clicking the "Exit" button, then existing callers assigned to the agent are moved to `pendingQueue[]`. That way, other agents can pick up those callers.
