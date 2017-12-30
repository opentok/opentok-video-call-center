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
