import { Router } from "express";

import {
  genres,
  getMovie,
  nowPlaying,
  popular,
  proxy,
  searchMovie,
  searchPerson,
  topRated,
  trending,
  upcoming,
} from "../controllers/tmdb.controller.js";

const router = Router();

router.get("/movie/:id", getMovie);
router.get("/search/movie", searchMovie);
router.get("/search/person", searchPerson);
router.get("/trending", trending);
router.get("/popular", popular);
router.get("/now-playing", nowPlaying);
router.get("/upcoming", upcoming);
router.get("/top-rated", topRated);
router.get("/genres", genres);
router.get("/proxy", proxy);

export default router;
