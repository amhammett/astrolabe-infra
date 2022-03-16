.PHONY: help list_account cdk_params build bootstrap deploy destroy

# tasks with double #'s will be displayed in help
help: ## this help text
	@echo 'Available targets'
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033$

guard-%: # ensure required variables are set
	@ if [ "${${*}}" = "" ]; then \
		echo "Variable $* not set. Specify via $*=<value>"; \
		exit 1; \
	fi

# these should be more generic
region := us-east-1
account := $(shell aws --profile=$(profile) sts get-caller-identity --query Account --output text)

list_account: | guard-profile ## display account via (profile)
	@echo using account $(account)

cdk_deploy_params := --profile=${profile} \
  -c region=${region} \
  -c account=${account} \
  -o cdk.out-${profile} \
  --require-approval never

cdk_params:
	@echo $(cdk_deploy_params)

bootstrap: | guard-profile guard-region ## bootstrap cdk
	npm run cdk -- bootstrap aws://$(account)/${region} $(cdk_deploy_params)

synth: | guard-profile guard-region guard-url bootstrap ## deploy resources in (profile)
	npm run cdk -- synth ${cdk_deploy_params}

deploy: | guard-profile guard-region bootstrap ## deploy resources in (profile)
	npm run cdk -- deploy ${cdk_deploy_params}

destroy: | guard-profile guard-region ## destroy resources in (profile)