# Show usage

This module generates a usage string for nopt options. It's based on [this](https://github.com/npm/nopt/pull/13) PR from Filirom1.

```
var noptUsage = require('nopt-usage');
noptUsage(knownOpts, shortHands, description1, description2, ...)
```
## install

    npm install nopt-usage

## example

You could pass as many description objects as you want. Take a look at the following example to understand how it could be used.

```
#!/usr/bin/env node

var nopt = require("nopt")
  , noptUsage = require("nopt-usage")
  , Stream = require("stream").Stream
  , path = require("path")
  , knownOpts = { "foo" : [String, null]
                , "bar" : [Stream, Number]
                , "baz" : path
                , "bloo" : [ "big", "medium", "small" ]
                , "flag" : Boolean
                , "pick" : Boolean
                }
  , shortHands = { "foofoo" : ["--foo", "Mr. Foo"]
                 , "b7" : ["--bar", "7"]
                 , "m" : ["--bloo", "medium"]
                 , "p" : ["--pick"]
                 , "f" : ["--flag", "true"]
                 , "g" : ["--flag"]
                 , "s" : "--flag"
                 }
  , description = { "foo" : "Something really foooooooo"
                  , "bar" : "A bar thing"
                  , "baz" : "More or less baz"
                  , "flag" : "Flag it as well"
                  , "pick" : "Or pick something"
                  }
  , defaults = { "foo" : null
               , "bar" : 42
               , "baz" : "/etc/passwd"
               , "bloo" : "small"
               , "pick" : false
               }
             // everything is optional.
             // knownOpts and shorthands default to {}
             // arg list defaults to process.argv
             // slice defaults to 2
  , parsed = nopt(knownOpts, shortHands, process.argv, 2)
  , usage = noptUsage(knownOpts, shortHands, description, defaults)

console.log('Usage: ')
console.log(usage)
```

The output is:

```
Usage:
    --foo, -foofoo        Something really foooooooo    null           
    --bar, -b7            A bar thing                   42             
    --baz                 More or less baz              /etc/passwd    
    --bloo, -m                                          small          
    --flag, -f, -g, -s    Flag it as well                              
    --pick, -p            Or pick something             false          
```

