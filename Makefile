node_modules: package-lock.json
	npm install --no-save
	@touch node_modules

deps: node_modules

lint: node_modules
	npx eslint --color .

test: node_modules lint
	NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest --color

unittest: node_modules
	NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest --color --watchAll

update: node_modules
	npx updates
	rm -rf node_modules
	npm install
	@touch node_modules

publish: node_modules
	git push -u --tags origin master
	npm publish

patch: node_modules test
	npx versions -C patch
	@$(MAKE) --no-print-directory publish

minor: node_modules test
	npx versions -C minor
	@$(MAKE) --no-print-directory publish

major: node_modules test
	npx versions -C major
	@$(MAKE) --no-print-directory publish

.PHONY: lint test unittest publish deps update patch minor major
