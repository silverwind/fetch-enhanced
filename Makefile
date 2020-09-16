lint:
	yarn -s run eslint --color .

test: lint
	yarn -s run jest --color

unittest:
	yarn -s run jest --color --watchAll

publish:
	git push -u --tags origin master
	npm publish

deps:
	rm -rf node_modules
	yarn

update:
	node updates -cu
	@$(MAKE) --no-print-directory deps

patch: test
	yarn -s run versions -C patch
	@$(MAKE) --no-print-directory publish

minor: test
	yarn -s run versions -C minor
	@$(MAKE) --no-print-directory publish

major: test
	yarn -s run versions -C major
	@$(MAKE) --no-print-directory publish

.PHONY: lint test unittest build publish deps update patch minor major
