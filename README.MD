# Rescue Shelter Services
Simple express server that expose web api for Rescue Shelter [readme](https://github.com/kscott5/RescueShelter/blob/master/README.MD)
```
yarn run watch
```

```
yarn run start
```

The server should start on localhost port 3302.
[http://localhost:3302/api/animals](http://localhost:3302/api/animals)  


## [MongoDB](https://docs.mongodb.com/manual/reference/operator/aggregation/lookup/index.html) & [Robo3t](https://www.robomongo.org/)
Join collections with MongoDB aggregate function  
  
> user defined variables  
> \$project  
> pipelines  
> \$lookup  
> \$filter  
> \$isArray  
> \$eq  
  
security.password is #P@ssw0rd1.  
  
## Animals Collection
``` 
db.animals.insert([
{
    "_id" : ObjectId("5d28b580d8d6bb70ee3b17b2"),
    "dates" : {
        "created" : ISODate("2019-07-12T16:29:52.732Z"),
        "modified" : ISODate("2019-07-12T16:29:52.732Z")
    },
    "sponsors" : [ 
        "flname@outlook.com"
    ],
    "name" : "Florida bonneted bat (Eumops floridanus)",
    "description" : "bat man",
    "imageSrc" : "https://live.staticflickr.com/3949/15541718041_300757f800_b.jpg",
    "endangered" : true,
    "__v" : 0
},
{
    "_id" : ObjectId("5d28d29266ada002d41006f1"),
    "dates" : {
        "created" : ISODate("2019-07-12T18:33:54.218Z"),
        "modified" : ISODate("2019-07-12T18:33:54.218Z")
    },
    "sponsors" : [ 
        "user.name@outlook.com", 
        "temp@gmail.com"
    ],
    "name" : "Elephant",
    "description" : "African region",
    "imageSrc" : "https://c402277.ssl.cf1.rackcdn.com/photos/11552/images/hero_small/rsz_namibia_will_burrard_lucas_wwf_us_1.jpg?1462219623",
    "endangered" : false,
    "__v" : 0
}])
```
  
## Sponsors Collection
``` 
db.sponsors.insert([
{
    "_id" : ObjectId("5d2c98df871e577d7304cf8f"),
    "firstname" : "FirstName",
    "lastname" : "LastName",
    "useremail" : "flname@outlook.com",
    "username" : "flnames",
    "security" : {
        "password" : "9bc4448f71fcd2eeff26c5afc0b62578ac1363426f1185896704428045e1e9f886dbab587ab5590d0c7ee3e73a4e78340ef9",
        "questions" : []
    },
    "audit" : [ 
        {
            "modified" : ISODate("2019-07-15T15:16:47.161Z"),
            "sponsor_id" : ObjectId("5d2c98df871e577d7304cf8f")
        }
    ],
    "__v" : 0
},
{
    "_id" : ObjectId("5d2cd9ed72cd95995f4c9e43"),
    "firstname" : "User",
    "lastname" : "Name",
    "useremail" : "user.name@outlook.com",
    "username" : "username",
    "security" : {
        "password" : "9bc4448f71fcd2eeff26c5afc0b62578ac1363426f1185896704428045e1e9f886dbab587ab5590d0c7ee3e73a4e78340ef9",
        "questions" : []
    },
    "audit" : [ 
        {
            "modified" : ISODate("2019-07-15T00:00:00.000Z"),
            "sponsor_id" : ObjectId("5d2cd9ed72cd95995f4c9e43")
        }
    ],
    "__v" : 0
}   
])
```
  
  ## Aggregate of Animals and Contributors 
[User Variables](https://docs.mongodb.com/manual/reference/aggregation-variables/index.html)
``` 
db.animals.aggregate([
    {
        $lookup: {
            from: "sponsors",
            let: {animals_sponsors: '$sponsors'},
            pipeline: [{
                $project: {
                    _id: false, useremail: 1, username: 1, 
                    is_sponsor: {$in: ['$useremail', '$$animals_sponsors']}
                }            
            }],
            as: "sponsors"
        }        
    },
    {
    $project: {
        name: 1, description: 1, sponsors: 1, endangered: 1, imageSrc: 1,
        sponsors_is_array: {$isArray: '$sponsors'},
        sponsors: '$sponsors',
        sponsors_filtered: {
            $filter: {
                input: '$sponsors',
                as: 'constributor',
                cond: {$eq: ['$$constributor.is_sponsor', true]}
            }
        }
    }}
])
```
  
## Aggregate results  
```
/* 1 */
{
    "_id" : ObjectId("5d28b580d8d6bb70ee3b17b2"),
    "name" : "Florida bonneted bat (Eumops floridanus)",
    "description" : "bat man",
    "imageSrc" : "https://live.staticflickr.com/3949/15541718041_300757f800_b.jpg",
    "endangered" : true,
    "sponsors" : [ 
        {
            "useremail" : "flname@outlook.com",
            "username" : "flnames",
            "is_sponsor" : true
        }, 
        {
            "useremail" : "user.name@outlook.com",
            "username" : "username",
            "is_sponsor" : false
        }
    ],
    "sponsors_is_array" : true,
    "sponsors_filtered" : [ 
        {
            "useremail" : "flname@outlook.com",
            "username" : "flnames",
            "is_sponsor" : true
        }
    ]
}

/* 2 */
{
    "_id" : ObjectId("5d28d29266ada002d41006f1"),
    "name" : "Elephant",
    "description" : "African region",
    "imageSrc" : "https://c402277.ssl.cf1.rackcdn.com/photos/11552/images/hero_small/rsz_namibia_will_burrard_lucas_wwf_us_1.jpg?1462219623",
    "endangered" : false,
    "sponsors" : [ 
        {
            "useremail" : "flname@outlook.com",
            "username" : "flnames",
            "is_sponsor" : false
        }, 
        {
            "useremail" : "user.name@outlook.com",
            "username" : "username",
            "is_sponsor" : true
        }
    ],
    "sponsors_is_array" : true,
    "sponsors_filtered" : [ 
        {
            "useremail" : "user.name@outlook.com",
            "username" : "username",
            "is_sponsor" : true
        }
    ]
}
```

## More
The [Security Service Typescript](https://github.com/kscott5/RescueShelter/blob/master/src/services/securityservice.ts) file contains $lookkup with authentication and hash identifier  
validation. Code Review it. 