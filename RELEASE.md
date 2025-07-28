In order to release the current canary build
* Make sure main is building successfully.  
  https://github.com/workflow86oss/mcp-server/actions
* Find the last released version `git log --tags`
* Make sure the version number in package.json has been bumped above the last version
* If it hasn't bump it, commit, and push to main
* `git tag v<new version>`
* `git push origin v<new version>`
* This will trigger a tag build. Make sure the build passes.  
https://github.com/workflow86oss/mcp-server/actions