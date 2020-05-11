## local dev

1. add localhost key  
    1. generate key ([skyway](https://console-webrtc-free.ecl.ntt.com/add))
    1. add /skyway/public/key.js file

```
window.__SKYWAY_KEY__ = 'YOUR_GENERATED_API_KEY';
```

2. exec local server  
```
/skyway $ node server.js
```

3. access localhost server  
http://localhost:3000/index.html

## refs  
 - [skyway/skyway-js-sdk](https://github.com/skyway/skyway-js-sdk/tree/master/examples/room)
