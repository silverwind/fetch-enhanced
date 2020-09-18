node_modules: yarn.lock
	@yarn -s --pure-lockfile
	@touch node_modules

deps: node_modules

update: node_modules
	yarn -s run updates -cu
	rm -rf node_modules
	yarn -s
	@touch yarn.lock

lint: node_modules
	yarn -s run eslint --color .

test: node_modules lint
	@# detectOpenHandles to prevent jest warning for agentkeepalive
	yarn -s run jest --color --detectOpenHandles

unittest: node_modules
	yarn -s run jest --color --watchAll

publish: node_modules
	git push -u --tags origin master
	npm publish

patch: node_modules test
	yarn -s run versions -C patch
	@$(MAKE) --no-print-directory publish

minor: node_modules test
	yarn -s run versions -C minor
	@$(MAKE) --no-print-directory publish

major: node_modules test
	yarn -s run versions -C major
	@$(MAKE) --no-print-directory publish

.PHONY: lint test unittest publish deps update patch minor major
