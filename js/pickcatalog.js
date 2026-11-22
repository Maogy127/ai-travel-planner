/* Local sample catalog; closures are inherited from OAHU_PLACE_RULES. */
(function(){
const catalog={
 "activities": [
  {
   "id": "diamond-head",
   "name": "Diamond Head",
   "category": "Outdoors",
   "area": "Diamond Head",
   "lat": 21.262,
   "lng": -157.805,
   "duration": 90,
   "effort": "Moderate",
   "price": "$5 pp",
   "photo": "images/activity-diamond-head-summit.jpg",
   "intro": "Explore Diamond Head. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "outdoors",
    "kids ok"
   ],
   "bookable": true,
   "musts": [
    "diamond",
    "head"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ],
   "fixed": 360
  },
  {
   "id": "kualoa",
   "name": "Kualoa Jurassic Adventure",
   "category": "Outdoors",
   "area": "Kualoa Ranch",
   "lat": 21.52,
   "lng": -157.837,
   "duration": 150,
   "effort": "Easy",
   "price": "$150 pp",
   "photo": "images/activity-kualoa.jpg",
   "intro": "Explore Kualoa Jurassic Adventure. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "outdoors",
    "kids ok"
   ],
   "bookable": true,
   "musts": [
    "kualoa",
    "jurassic"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "dive",
   "name": "Intro dive Kewalo",
   "category": "Water",
   "area": "Kewalo Basin",
   "lat": 21.29,
   "lng": -157.86,
   "duration": 180,
   "effort": "Moderate",
   "price": "$150 pp",
   "photo": "images/activity-kewalo.jpg",
   "intro": "Explore Intro dive Kewalo. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "water",
    "kids ok",
    "dive",
    "water"
   ],
   "bookable": true,
   "musts": [
    "intro",
    "dive",
    "scuba"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ],
   "minAge": 10
  },
  {
   "id": "parasail",
   "name": "Parasail Waikiki",
   "category": "Water",
   "area": "Kewalo Basin",
   "lat": 21.29,
   "lng": -157.86,
   "duration": 60,
   "effort": "Easy",
   "price": "$90 pp",
   "photo": "images/activity-parasail.jpg",
   "intro": "Explore Parasail Waikiki. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "water",
    "kids ok"
   ],
   "bookable": true,
   "musts": [
    "parasail",
    "parasailing"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "lanikai",
   "name": "Lanikai Pillbox sunrise",
   "category": "Outdoors",
   "area": "Kailua",
   "lat": 21.39,
   "lng": -157.715,
   "duration": 90,
   "effort": "Active",
   "price": "Free",
   "photo": "images/activity-lanikai.jpg",
   "intro": "Explore Lanikai Pillbox sunrise. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "outdoors",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "lanikai",
    "pillbox",
    "sunrise"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ],
   "fixed": 360
  },
  {
   "id": "makapuu",
   "name": "Makapuʻu Lighthouse Trail",
   "category": "Outdoors",
   "area": "Makapuu",
   "lat": 21.31,
   "lng": -157.65,
   "duration": 90,
   "effort": "Moderate",
   "price": "Free",
   "photo": "images/activity-makapuu.jpg",
   "intro": "Explore Makapuʻu Lighthouse Trail. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "outdoors",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "makapuu",
    "lighthouse"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "kahala",
   "name": "Kahala sunset photos",
   "category": "Chill",
   "area": "Kahala",
   "lat": 21.27,
   "lng": -157.77,
   "duration": 45,
   "effort": "Easy",
   "price": "Free",
   "photo": "images/activity-kahala-beach.jpg",
   "intro": "Explore Kahala sunset photos. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "chill",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "kahala",
    "sunset",
    "photos"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ],
   "fixed": 1020
  },
  {
   "id": "waikiki",
   "name": "Waikiki sunset",
   "category": "Chill",
   "area": "Waikiki",
   "lat": 21.276,
   "lng": -157.827,
   "duration": 45,
   "effort": "Easy",
   "price": "Free",
   "photo": "images/activity-waikiki-sunset.jpg",
   "intro": "Explore Waikiki sunset. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "chill",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "waikiki",
    "sunset"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ],
   "fixed": 1020
  },
  {
   "id": "hanauma",
   "name": "Hanauma Bay snorkel",
   "category": "Water",
   "area": "East Oahu",
   "lat": 21.269,
   "lng": -157.694,
   "duration": 120,
   "effort": "Moderate",
   "price": "$25 pp",
   "photo": "images/activity-hanauma.jpg",
   "intro": "Reserve an entry time. Snorkel only in safe conditions.",
   "hours": {
    "open": 405,
    "close": 960
   },
   "tags": [
    "water",
    "kids ok"
   ],
   "bookable": true,
   "musts": [
    "hanauma"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "pearl-harbor",
   "name": "Pearl Harbor / USS Arizona",
   "category": "Culture",
   "area": "Pearl Harbor",
   "lat": 21.365,
   "lng": -157.95,
   "duration": 150,
   "effort": "Easy",
   "price": "Free",
   "photo": "images/activity-pearl-harbor.jpg",
   "intro": "Explore Pearl Harbor / USS Arizona. Allow time for the route.",
   "hours": {
    "open": 420,
    "close": 1020
   },
   "tags": [
    "culture",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "pearl",
    "harbor"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "bishop-museum",
   "name": "Bishop Museum",
   "category": "Culture",
   "area": "Kalihi",
   "lat": 21.333,
   "lng": -157.87,
   "duration": 120,
   "effort": "Easy",
   "price": "$34 pp",
   "photo": "images/activity-bishop-museum.jpg",
   "intro": "Explore Bishop Museum. Allow time for the route.",
   "hours": {
    "open": 540,
    "close": 1020
   },
   "tags": [
    "culture",
    "kids ok"
   ],
   "bookable": true,
   "musts": [
    "bishop",
    "museum"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "pcc",
   "name": "Polynesian Cultural Center",
   "category": "Culture",
   "area": "North Shore",
   "lat": 21.64,
   "lng": -157.92,
   "duration": 240,
   "effort": "Easy",
   "price": "$90 pp",
   "photo": "images/activity-pcc.jpg",
   "intro": "Explore Polynesian Cultural Center. Allow time for the route.",
   "hours": {
    "open": 750,
    "close": 1260
   },
   "tags": [
    "culture",
    "kids ok"
   ],
   "bookable": true,
   "musts": [
    "pcc"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "iolani",
   "name": "ʻIolani Palace tour",
   "category": "Culture",
   "area": "Downtown",
   "lat": 21.307,
   "lng": -157.858,
   "duration": 90,
   "effort": "Easy",
   "price": "$30 pp",
   "photo": "images/activity-iolani.jpg",
   "intro": "Explore ʻIolani Palace tour. Allow time for the route.",
   "hours": {
    "open": 540,
    "close": 960
   },
   "tags": [
    "culture",
    "kids ok"
   ],
   "bookable": true,
   "musts": [
    "iolani"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "waimea",
   "name": "Waimea Bay",
   "category": "Chill",
   "area": "North Shore",
   "lat": 21.64,
   "lng": -158.065,
   "duration": 90,
   "effort": "Easy",
   "price": "Free",
   "photo": "images/activity-waimea.jpg",
   "intro": "Explore Waimea Bay. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "chill",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "waimea"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "manoa",
   "name": "Mānoa Falls hike",
   "category": "Outdoors",
   "area": "Manoa",
   "lat": 21.342,
   "lng": -157.8,
   "duration": 120,
   "effort": "Moderate",
   "price": "Free",
   "photo": "images/activity-manoa.jpg",
   "intro": "Explore Mānoa Falls hike. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "outdoors",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "manoa"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "koko-crater",
   "name": "Koko Crater",
   "category": "Outdoors",
   "area": "East Oahu",
   "lat": 21.28,
   "lng": -157.688,
   "duration": 120,
   "effort": "Active",
   "price": "Free",
   "photo": "images/activity-koko-crater.jpg",
   "intro": "Explore Koko Crater. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "outdoors",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "koko",
    "crater"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "surf",
   "name": "Waikiki surf lesson",
   "category": "Water",
   "area": "Waikiki",
   "lat": 21.276,
   "lng": -157.827,
   "duration": 90,
   "effort": "Active",
   "price": "$100 pp",
   "photo": "images/activity-surf.jpg",
   "intro": "Explore Waikiki surf lesson. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "water",
    "kids ok"
   ],
   "bookable": true,
   "musts": [
    "surf"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "sharks-cove",
   "name": "Sharks Cove snorkel",
   "category": "Water",
   "area": "North Shore",
   "lat": 21.65,
   "lng": -158.06,
   "duration": 90,
   "effort": "Moderate",
   "price": "Free",
   "photo": "images/activity-sharks-cove.jpg",
   "intro": "Summer is best for snorkeling. Winter surf: stay out.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "water",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "sharks",
    "cove"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "dole",
   "name": "Dole Plantation",
   "category": "Culture",
   "area": "North Shore",
   "lat": 21.526,
   "lng": -158.037,
   "duration": 90,
   "effort": "Easy",
   "price": "$15 pp",
   "photo": "images/activity-dole.jpg",
   "intro": "Explore Dole Plantation. Allow time for the route.",
   "hours": {
    "open": 570,
    "close": 1050
   },
   "tags": [
    "culture",
    "kids ok"
   ],
   "bookable": true,
   "musts": [
    "dole"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "magic-island",
   "name": "Magic Island sunset",
   "category": "Chill",
   "area": "Ala Moana",
   "lat": 21.283,
   "lng": -157.848,
   "duration": 45,
   "effort": "Easy",
   "price": "Free",
   "photo": "images/activity-magic-island.jpg",
   "intro": "Explore Magic Island sunset. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "chill",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "magic",
    "island"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ],
   "fixed": 1020
  },
  {
   "id": "ala-moana",
   "name": "Ala Moana Center",
   "category": "Shopping",
   "area": "Ala Moana",
   "lat": 21.291,
   "lng": -157.843,
   "duration": 120,
   "effort": "Easy",
   "price": "Free",
   "photo": "images/activity-ala-moana.jpg",
   "intro": "Explore Ala Moana Center. Allow time for the route.",
   "hours": {
    "open": 600,
    "close": 1200
   },
   "tags": [
    "shopping",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "ala",
    "moana",
    "black friday",
    "shopping"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "royal-hawaiian-center",
   "name": "Royal Hawaiian Center",
   "category": "Shopping",
   "area": "Waikiki",
   "lat": 21.28,
   "lng": -157.828,
   "duration": 90,
   "effort": "Easy",
   "price": "Free",
   "photo": "images/activity-royal-hawaiian-center.jpg",
   "intro": "Explore Royal Hawaiian Center. Allow time for the route.",
   "hours": {
    "open": 600,
    "close": 1260
   },
   "tags": [
    "shopping",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "royal",
    "hawaiian",
    "center"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "laniakea",
   "name": "Laniakea turtle beach",
   "category": "Chill",
   "area": "North Shore",
   "lat": 21.618,
   "lng": -158.086,
   "duration": 60,
   "effort": "Easy",
   "price": "Free",
   "photo": "images/activity-laniakea.jpg",
   "intro": "Explore Laniakea turtle beach. Allow time for the route.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "chill",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "laniakea"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  },
  {
   "id": "kahala-downtime",
   "name": "Kahala pool & beach",
   "category": "Chill",
   "area": "Kahala",
   "lat": 21.27,
   "lng": -157.77,
   "duration": 120,
   "effort": "Easy",
   "price": "Free",
   "photo": "images/activity-kahala-lagoon.jpg",
   "intro": "Slow down by the hotel pool or beach.",
   "hours": {
    "open": 360,
    "close": 1080
   },
   "tags": [
    "chill",
    "kids ok"
   ],
   "bookable": false,
   "musts": [
    "hotel downtime",
    "pool"
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "A memorable stop."
    },
    {
     "stars": 4,
     "text": "Allow extra travel time."
    }
   ]
  }
 ],
 "restaurants": [
  {
   "id": "lamer",
   "name": "La Mer at Halekulani",
   "section": "popular",
   "cuisine": "French",
   "meals": [
    "dinner"
   ],
   "area": "Waikiki",
   "lat": 21.28,
   "lng": -157.828,
   "price": "$$$$",
   "photo": "images/activity-halekulani.jpg",
   "duration": 120,
   "intro": "French favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": false,
   "reservation": {
    "date": "2026-11-26",
    "time": "19:30",
    "locked": true
   }
  },
  {
   "id": "senia",
   "name": "Senia Chinatown",
   "section": "picks",
   "cuisine": "Seasonal",
   "meals": [
    "dinner"
   ],
   "area": "Chinatown",
   "lat": 21.3,
   "lng": -157.85,
   "price": "$$$$",
   "photo": "images/food-chinatown.jpg",
   "duration": 120,
   "intro": "Seasonal favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": false,
   "reservation": {
    "date": "2026-11-27",
    "time": "18:00",
    "locked": true
   }
  },
  {
   "id": "kalapawai",
   "name": "Kalapawai Market",
   "section": "picks",
   "cuisine": "Deli",
   "meals": [
    "breakfast",
    "lunch"
   ],
   "area": "Kailua",
   "lat": 21.39,
   "lng": -157.715,
   "price": "$$",
   "photo": "images/food-kalapawai.jpg",
   "duration": 60,
   "intro": "Deli favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": false
  },
  {
   "id": "leonards",
   "name": "Leonard’s Bakery",
   "section": "popular",
   "cuisine": "Malasadas",
   "meals": [
    "breakfast",
    "snack"
   ],
   "area": "Kapahulu",
   "lat": 21.3,
   "lng": -157.85,
   "price": "$",
   "photo": "images/food-leonards.jpg",
   "duration": 60,
   "intro": "Malasadas favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": false
  },
  {
   "id": "rainbow",
   "name": "Rainbow Drive-In",
   "section": "popular",
   "cuisine": "Hawaiian",
   "meals": [
    "lunch",
    "dinner"
   ],
   "area": "Kapahulu",
   "lat": 21.3,
   "lng": -157.85,
   "price": "$",
   "photo": "images/food-rainbow-locomoco.jpg",
   "duration": 60,
   "intro": "Hawaiian favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": true
  },
  {
   "id": "helenas",
   "name": "Helena’s Hawaiian Food",
   "section": "picks",
   "cuisine": "Hawaiian",
   "meals": [
    "lunch",
    "dinner"
   ],
   "area": "Kalihi",
   "lat": 21.333,
   "lng": -157.87,
   "price": "$$",
   "photo": "images/food-helenas.jpg",
   "duration": 60,
   "intro": "Hawaiian favorites. Hours and prices are samples.",
   "hours": {
    "open": 600,
    "close": 1170
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": false
  },
  {
   "id": "giovannis",
   "name": "Giovanni’s Shrimp Truck",
   "section": "popular",
   "cuisine": "Shrimp",
   "meals": [
    "lunch"
   ],
   "area": "North Shore",
   "lat": 21.618,
   "lng": -158.086,
   "price": "$$",
   "photo": "images/food-giovannis.jpg",
   "duration": 60,
   "intro": "Shrimp favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": false
  },
  {
   "id": "matsumoto",
   "name": "Matsumoto Shave Ice",
   "section": "popular",
   "cuisine": "Shave ice",
   "meals": [
    "snack"
   ],
   "area": "North Shore",
   "lat": 21.618,
   "lng": -158.086,
   "price": "$",
   "photo": "images/food-matsumoto.jpg",
   "duration": 60,
   "intro": "Shave ice favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": false
  },
  {
   "id": "udon",
   "name": "Marukame Udon",
   "section": "popular",
   "cuisine": "Udon",
   "meals": [
    "lunch",
    "dinner"
   ],
   "area": "Waikiki",
   "lat": 21.28,
   "lng": -157.828,
   "price": "$",
   "photo": "images/food-udon.jpg",
   "duration": 60,
   "intro": "Udon favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": true
  },
  {
   "id": "poke",
   "name": "Ono Seafood",
   "section": "picks",
   "cuisine": "Poke",
   "meals": [
    "lunch"
   ],
   "area": "Kapahulu",
   "lat": 21.3,
   "lng": -157.85,
   "price": "$$",
   "photo": "images/food-poke.jpg",
   "duration": 60,
   "intro": "Poke favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": true
  },
  {
   "id": "acai",
   "name": "Island Vintage Coffee",
   "section": "picks",
   "cuisine": "Açaí",
   "meals": [
    "breakfast",
    "lunch"
   ],
   "area": "Waikiki",
   "lat": 21.28,
   "lng": -157.828,
   "price": "$$",
   "photo": "images/food-acai.jpg",
   "duration": 60,
   "intro": "Açaí favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": true
  },
  {
   "id": "musubi",
   "name": "Musubi Cafe Iyasume",
   "section": "popular",
   "cuisine": "Musubi",
   "meals": [
    "breakfast",
    "snack"
   ],
   "area": "Waikiki",
   "lat": 21.28,
   "lng": -157.828,
   "price": "$",
   "photo": "images/food-musubi.jpg",
   "duration": 60,
   "intro": "Musubi favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": true
  },
  {
   "id": "highway",
   "name": "Highway Inn",
   "section": "picks",
   "cuisine": "Hawaiian",
   "meals": [
    "lunch",
    "dinner"
   ],
   "area": "Kakaako",
   "lat": 21.3,
   "lng": -157.85,
   "price": "$$",
   "photo": "images/food-laulau.jpg",
   "duration": 60,
   "intro": "Hawaiian favorites. Hours and prices are samples.",
   "hours": {
    "open": 420,
    "close": 1260
   },
   "sampleMenu": [
    {
     "name": "House favorite",
     "price": "$18"
    },
    {
     "name": "Seasonal plate",
     "price": "$24"
    },
    {
     "name": "Small bite",
     "price": "$9"
    }
   ],
   "sampleReviews": [
    {
     "stars": 5,
     "text": "An enjoyable meal."
    },
    {
     "stars": 4,
     "text": "Plan for a wait."
    }
   ],
   "exampleDish": true
  }
 ]
};
const menus={lamer:['Seasonal fish','Tasting menu','Dessert'],senia:['Seasonal vegetables','Roasted fish','Dessert'],kalapawai:['Breakfast sandwich','Deli sandwich','Salad'],leonards:['Original malasada','Custard malasada','Cinnamon malasada'],rainbow:['Loco moco','Plate lunch','Chili rice'],helenas:['Pipikaula','Kalua pig','Lomi salmon'],giovannis:['Garlic shrimp','Lemon shrimp','Hot shrimp'],matsumoto:['Shave ice','Ice cream','Azuki topping'],udon:['Kake udon','Kitsune udon','Vegetable tempura'],poke:['Ahi poke','Shoyu poke','Poke bowl'],acai:['Açaí bowl','Coffee','Fruit bowl'],musubi:['Spam musubi','Egg musubi','Rice ball'],highway:['Laulau','Kalua pig','Hawaiian plate']};
for(const item of [...catalog.activities,...catalog.restaurants]){
 if(item.sampleMenu)item.sampleMenu.forEach((m,i)=>{m.name=menus[item.id][i];m.price=['$8','$16','$24'][i];});
 if(item.reservation)item.hours.close=1320;
 const rule=Object.assign({},...(window.OAHU_PLACE_RULES||[]).filter(r=>item.name.toLowerCase().includes(r.name.toLowerCase())));
 item.closed=rule.closed||[];
 item.closedDays=item.closed.flatMap(r=>r.weekdays||[]);
 item.closedDates=item.closed.filter(r=>r.date).map(r=>r.date);
 if(rule.hours&&!rule.hours.date)item.hours=rule.hours;
 item.ruleHours=rule.hours;
}
function eligible(item,a){return !item.minAge||!(a.ages||[]).some(age=>String(age).trim()!==''&&Number(age)<item.minAge);}
function must(item,a){const text=(a.mustdos||'').toLowerCase();return !!text&&(item.musts||[]).some(k=>k.length>3&&text.includes(k));}
function score(i,a){let n=must(i,a)?100:0;const prefs=JSON.stringify([a.styles,a.activities,a.interests]).toLowerCase();if((i.category==='Outdoors'&&/nature|scenic|hike/.test(prefs))||(i.category==='Culture'&&/culture/.test(prefs))||(i.category==='Water'&&/water|swim|surf/.test(prefs))||(i.category==='Chill'&&/hotel|relax/.test(prefs)))n+=10;if((a.level==='gentle'&&i.effort==='Easy')||(a.level==='athlete'&&i.effort==='Active')||(a.level==='active'&&i.effort==='Moderate'))n+=5;const budget=window.GoNowBudget;if(budget){const rank=budget.priceRank(i.price),max=budget.maxRank(a||{});if(rank&&rank<=max)n+=4-rank;else if(rank>max)n-=30*(rank-max);}return n;}
function searchText(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[ʻʼ’']/g,'').toLowerCase();}
function filter(items,query,chip,a){a=a||{};const budget=window.GoNowBudget,q=searchText(query);return items.filter(i=>eligible(i,a)&&(!chip||chip==='All'||i.category===chip||(i.meals||[]).includes(chip.toLowerCase().replace('snacks','snack')))&&[i.name,i.cuisine,i.area,i.category,...(i.tags||[])].some(value=>searchText(value).includes(q))&&(q||!budget||budget.fits(i,a))).sort((x,y)=>score(y,a)-score(x,a));}
window.GONOW_PICKS={oahu:catalog};window.PickCatalog={eligible,must,filter,duration:minutes=>minutes<60?minutes+' min':Number((minutes/60).toFixed(2))+' h',count:(count,total,capacity)=>'Picked '+count+(count?' · about '+Math.max(1,Math.ceil(total/capacity))+' '+(Math.ceil(total/capacity)<=1?'day':'days'):'')};
})();
