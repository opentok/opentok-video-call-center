# OpenTok Call Center Demo

This demo showcases a simulation of call center where callers queue up to talk to available agents using OpenTok.

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
Start the server:

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
