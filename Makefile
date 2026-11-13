# All tooling runs inside Docker; the host only needs docker + make (+ Thunderbird for manual tests).
IMAGE      := hdh-dev:latest
UID_GID    := $(shell id -u):$(shell id -g)
DOCKER_RUN := docker run --rm -u $(UID_GID) -v "$(CURDIR)":/app/project $(IMAGE)
TB         ?= thunderbird
TB_PROFILE ?= $(CURDIR)/.tbprofile

.PHONY: image vendor lint test check xpi shell tb-test tb-test-latest clean

# Rebuild the image whenever the dependency list changes.
image:
	docker build -t $(IMAGE) -f docker/Dockerfile .

# Copy runtime libraries from the image into the add-on (re-run after bumping them).
vendor: image
	mkdir -p src/vendor
	$(DOCKER_RUN) sh -c 'sed "/sourceMappingURL/d" /app/node_modules/dompurify/dist/purify.es.mjs > src/vendor/purify.es.mjs && \
		cp /app/node_modules/dompurify/LICENSE src/vendor/purify.LICENSE.txt'

lint: image
	$(DOCKER_RUN) eslint .
	$(DOCKER_RUN) web-ext lint --source-dir src --self-hosted

test: image
	$(DOCKER_RUN) vitest run --configLoader runner

check: lint test

xpi: check
	$(DOCKER_RUN) web-ext build --source-dir src --artifacts-dir dist \
		--filename "helpdesk-helper-{version}.xpi" --overwrite-dest

shell: image
	docker run --rm -it -u $(UID_GID) -v "$(CURDIR)":/app/project $(IMAGE) bash

# Throwaway Thunderbird profile for manual testing (deletable: make clean).
# Other versions: make tb-test TB=.cache/thunderbird/thunderbird
tb-test:
	mkdir -p "$(TB_PROFILE)"
	"$(TB)" -no-remote -profile "$(TB_PROFILE)" &

# Latest release from ./.cache (see TESTING.md), with its OWN profile: a newer Thunderbird
# upgrades a profile, after which the older version refuses to open it.
tb-test-latest:
	$(MAKE) tb-test TB="$(CURDIR)/.cache/thunderbird/thunderbird" TB_PROFILE="$(CURDIR)/.tbprofile-latest"

clean:
	rm -rf dist .tbprofile .tbprofile-latest
