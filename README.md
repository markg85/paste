## Paste
Paste is a small webservice that you can use to, well, paste.
You can use the website, it only allows you to paste text in the input fields.
You can also use curl which allows you to use whatever you can on the site + paste binary data such as images or whole files.
The limit for files is set at 10 MiB per file.

## Installation
You need to have a running MongoDB that can be accessed by the name "mongo". If you have a different name you need to change server.js accordingly.
By default it runs on port 80, you can also change that in server.js.
If you have done the changes, it's just a:
1. npm install
2. node server.js

And you're done.

## Todo (for version 1.0.0)
1. Limit the amount of pastes one can do. Right now you "could" spam the server with textual pastes or even binary ones (via curl).
It would be far better if there is a limit to how much you can paste (in terms of "pastes per second", not paste size). A few pastes per
minute seems like a nice setting.
2. Rewrite the backend to promise based.
3. Split the backend and gui. The backend and gui are in the same project now. That's working ok, but it would be nicer if the backend and gui 
were two seperate projects.
4. Document the API.
5. Improve the GUI to load pastes "in place" without redirecting. That is already possible (it's a mere AJAX call at the moment), just not implemented.
6. Remember the values set in paste language and lifetime.
7. The lifetime right now is stub. It's added to a paste, stored, but never checked to clean up.
8. Paste now uses "shortid" to benerate short id's, but i'm not really happy with it. Find a better way. Perhaps based on base58 from flickr.
Or https://codepen.io/ivanakimov/pen/bNmExm or http://hashids.org/ or https://engineering.instagram.com/sharding-ids-at-instagram-1cf5a71e5a5c
