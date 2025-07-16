# PlayTak-UI
Javascript based Play Tak web client

Playtak backend can be found here: [playtak-api](https://github.com/USTakAssociation/playtak-api)

## Getting Started
Pull the source by cloning the repository, then cd in to the project
```
git clone git@github.com:USTakAssociation/playtak-ui.git
cd playtak-ui
```

Install the dev dependencies to run localy or run it using some web server like apache or nginx.

Running locally with NodeJs requires (version 14 or later) and NPM. [Node](http://nodejs.org/) and [NPM](https://npmjs.org/) which are really easy to install.

To make sure you have them available on your machine, try running the following command.

```sh
node -v && npm -v
```

To get started run the following:
```
npm i
npm run dev
```

This will start a local dev server for you 

If you make any changes just reload the page as caching is turned off

To play locally against the live playtak server in the /src/js/server.js on line 208 uncomment that line and reload


## TODO
- Hot reloading
- Paramatize environment variables
- Implement build tooling?
- Some sort of testing
- github action for pull request checks

## Contributing
PlayTak is an OPEN Open Source Project. This means that:

> Individuals making significant and valuable contributions are given commit-access to the project to contribute as they see fit.

Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

1. Fork it!
2. Create your feature branch: git checkout -b my-new-feature
3. Add your changes: git add .
4. Commit your changes: git commit -am 'Add some feature'
5. Push to the branch: git push origin my-new-feature
6. Submit a pull request

## Versioning
We use [SemVer](http://semver.org/) for versioning. For the versions available, see the tags on this repository.

## Contributors
Play tak is only possible due to the excellent work of the following contributors:

||
:----:|
|[chaitu](https://github.com/chaitu236)|
|[Nohat](https://github.com/NoHatCoder)|
|[Nitzel](https://github.com/nitzel)|
|[InvaderB](https://github.com/invaderb)|

See also the list of contributors who participated in this project.

This project is tested with BrowserStack.

License
MIT License © USTA see LICENSE.md file

