/**
 * Every tunable number of the recommendation system lives here, so the behaviour can be adjusted
 * without touching the algorithm itself.
 */
export const REC = {
  /** Fewer weighted signals than this and the feed falls back to the general (cold start) mix. */
  minSignals: 3,
  /**
   * Titles (watched, rated or on the watchlist) a user needs before the For You page shows a
   * personal feed; until then it asks them to add more (see `TasteSetup`).
   */
  minTitlesForFeed: 5,
  /** Signals needed before the taste profile gets its full weight in the score. */
  fullConfidenceSignals: 8,

  /** Weights of the signals (see `signals.ts`). */
  weights: {
    watchedUnrated: 0.3,
    watchlist: 0.5,
    dismissed: -0.7,
  },
  /** An old signal counts half as much every `halfLifeDays`, but never less than `minDecay`. */
  halfLifeDays: 180,
  minDecay: 0.25,

  /** How many titles are used to learn the taste: the best-liked ones and the latest hidden ones. */
  positiveSeedLimit: 24,
  negativeSeedLimit: 10,
  /** How many of the best-liked titles ask TMDB for "people who liked this also liked". */
  recommendationSeeds: 8,
  /** A new seed this similar to one already chosen waits, so the seeds cover more than one corner. */
  seedDiversity: 0.68,
  /** Negative signals needed before candidate-level suppression gets its full weight. */
  negativeConfidence: 3,

  /** Shrinkage of a feature's affinity: a single title cannot define a taste on its own. */
  shrinkage: 1.5,
  /** Features present in most of the user's titles say less than rare ones. */
  commonDamping: 0.6,

  /** Score = weighted sum of these parts (taste and quality trade weight, see `scoring.ts`). */
  score: {
    content: 0.45,
    seed: 0.2,
    quality: 0.2,
    popularity: 0.1,
    freshness: 0.05,
    /** A title that looks like something hidden or rated low loses this share of its score. */
    negative: 0.2,
  },

  /**
   * Freshness is measured against the years the user actually likes: someone who only watches
   * new releases should not get 1990s titles, while a retro fan keeps theirs.
   */
  freshness: {
    /** Fallback half-life for profiles without enough dated titles. */
    halfLifeYears: 20,
    /** How far from the liked years still counts as a good match. */
    minSpreadYears: 6,
    maxSpreadYears: 20,
  },

  /** Actors the user keeps meeting in the titles they save and rate highly. */
  cast: {
    /** How many recurring actors get their own TMDB query. */
    queryLimit: 3,
    /** An actor has to appear in this many titles before it counts as a favourite. */
    minTitles: 2,
    /** At most this many credits are taken from one actor's filmography. */
    creditLimit: 60,
  },
  /** Bayesian rating: titles with few votes are pulled towards the global average. */
  bayesVotes: 300,
  bayesMean: 6.6,
  /** Each earlier impression of a title lowers its score by this share (up to `maxImpressions`). */
  impressionPenalty: 0.2,
  maxImpressions: 3,

  /** Diversity re-ranking: 1 = pure relevance, lower = more variety. */
  mmrLambda: 0.75,
  /** Every n-th feed slot is an exploration pick (something outside the usual taste). */
  exploreEvery: 7,

  /** How many pages of one TMDB query are walked through before it is considered used up. */
  maxPagesPerQuery: 6,
  /** High-priority sources are fetched first; this many at most per refill. */
  queriesPerRefill: 6,
  recommendationPages: 2,
  /** The pool is topped up until it holds this many titles per requested title. */
  poolPerRequested: 3,

  /** Local caches. */
  featureTtlDays: 14,
  featureCacheLimit: 500,
  impressionCacheLimit: 2000,
  /** An open feed is kept (so going to a title and back is instant) for this long. */
  sessionMinutes: 30,
} as const
