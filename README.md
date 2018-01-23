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
