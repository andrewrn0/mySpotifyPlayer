import express from "express";
import axios from "axios";
import queryString from "query-string";
import bodyParser from "body-parser";
import { authRouter, getAuthConfig } from "./routes/auth.js";

const app = express();
const port = 3000;

//The base endpoint I am using for all my simple api calls in this proj
const API_URL = "https://api.spotify.com/v1/me/player";

//Good practice to still use body parser rather than native bodyparser-derived
//middleware because its very clear what this middleware is doing when its imported
//as body-parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
//This diverts all auth-related req's to an external file, purely for file org. Acts
//similarly to middleware, and it kinda is-- it's authentication middleware. This line
//of code is simple saying "for routes that start in /auth, use the authRouter we imported from auth.js"
app.use("/auth", authRouter);

function errorHandler(error, req) {
  if (
    error.response.data.error.status === 401 &&
    error.response.data.error.message === "The access token expired"
  ) {
    //This just takes the client to refresh the token in auth.js
    //I'm using a query string to pass in the route that tried to used the expired
    //token so that /auth/refreshToken can re-run the failed route with a fresh token
    //to do this, I decided to simply use a query string.
    const query = queryString.stringify({
      routeTokenExpiredOn: req.originalUrl,
    });
    return res.redirect("/auth/refreshToken" + query);
  } else {
    switch (req.originalUrl) {
      case "/initialPlay":
        console.log("Internal Error Message: Error playing initial playlist");
        break;
      case "/player":
        console.log("Internal Error Message: Error starting the music player");
        break;
      case "/togglePlayback":
        console.log("Internal Error Message: Error playing/pausing the music");
        break;
      case "/previous":
        console.log("Internal Error Message: Error skipping to previous song");
        break;
      case "/next":
        console.log("Internal Error Message: Error skipping to next song");
        break;
    }
    return console.log(
      "HTTP error message: " + error.response.data.error.message
    );
  }
}

//serve up the landing page
app.get("/", (req, res) => {
  try {
    res.render("landing.ejs");
  } catch (error) {
    res.status(500);
    errorHandler(error, req);
  }
});

//This route is essentially just to get something playing
app.get("/initialPlay", async (req, res) => {
  try {
    //Get the first active device
    const fetchedDevices = await axios.get(
      API_URL + "/devices",
      getAuthConfig()
    );

    //if active device, play it
    if (fetchedDevices.data.devices[0] != null) {
      const device_id = [fetchedDevices.data.devices[0].id];

      await axios.put(
        API_URL,
        { device_ids: device_id, play: true },
        getAuthConfig()
      );
      return res.redirect("/player");

      //if no active devices, render the /player without data
      //which prompts user to open a spotify app somewhere and try again
    } else {
      res.render("index.ejs");
    }
  } catch (error) {
    res.status(500);
    errorHandler(error, req);
  }
});

//The main "homepage", if you will
app.get("/player", async (req, res) => {
  try {
    const fetchedPlaybackState = await axios.get(
      API_URL + "/currently-playing",
      getAuthConfig()
    );
    const fetchedQueue = await axios.get(API_URL + "/queue", getAuthConfig());

    res.render("index.ejs", {
      trackName: fetchedPlaybackState.data.item.name,
      artistNames: fetchedPlaybackState.data.item.artists,
      imageURL: fetchedPlaybackState.data.item.album.images[0].url,
      queue: fetchedQueue.data.queue.slice(0, 10),
    });
  } catch (error) {
    res.status(500);
    errorHandler(error, req);
  }
});

app.post("/togglePlayback", async (req, res) => {
  try {
    //First test if there is something currently playing
    //Null is critical for axios.put, since second arg is data, which this req does not have
    const result = await axios.get(API_URL, getAuthConfig());

    if (result.data.is_playing) {
      await axios.put(API_URL + "/pause", null, getAuthConfig());
    } else {
      await axios.put(API_URL + "/play", null, getAuthConfig());
    }
  } catch (error) {
    res.status(500);
    errorHandler(error, req);
  }
});

app.post("/previous", async (req, res) => {
  try {
    const result = await axios.post(
      API_URL + "/previous",
      null,
      getAuthConfig()
    );
    return res.redirect("/player");
  } catch (error) {
    res.status(500);
    errorHandler(error, req);
  }
});

app.post("/next", async (req, res) => {
  try {
    const result = await axios.post(API_URL + "/next", null, getAuthConfig());
    return res.redirect("/player");
  } catch (error) {
    res.status(500);
    errorHandler(error, req);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
