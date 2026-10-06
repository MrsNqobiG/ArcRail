> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Create Policy

> Setup a new Policy for your organization.
  
  Every policy requires a rule to be specified. Upon policy evaluation, the configuration specified in the rule will be used to determine whether the policy should trigger or not for a given activity.
  
  By exposing controls on permissions and policies, Dfns enables the specification of an admin quorum to approve sensitive actions which could change system governance.   Note Dfns does not expose a separate "admin quorum" concept like some of our competitors - we simply enable this use case as another configuration of the policy engine itself.   This was chosen to promote flexibility as not every customer will have the same requirements around creating and managing admin quorums.

#### Authentication

✅ Organization User (`CustomerEmployee`)\
❌ Delegated User (`EndUser`)\
✅ Service Account

#### Required Permissions

`Policies:Create`: Always required.


## OpenAPI

````yaml /openapi.yaml post /v2/policies
openapi: 3.1.0
info:
  version: 2.0.155
  title: Dfns
servers:
  - url: https://api.dfns.io
    description: Default - Europe
  - url: https://api.uae.dfns.io
    description: UAE
  - url: https://api.dfns.ninja
    description: <Deprecated> Staging
security: []
paths:
  /v2/policies:
    post:
      tags:
        - Policies
      summary: Create Policy
      description: |-
        Setup a new Policy for your organization.
          
          Every policy requires a rule to be specified. Upon policy evaluation, the configuration specified in the rule will be used to determine whether the policy should trigger or not for a given activity.
          
          By exposing controls on permissions and policies, Dfns enables the specification of an admin quorum to approve sensitive actions which could change system governance.   Note Dfns does not expose a separate "admin quorum" concept like some of our competitors - we simply enable this use case as another configuration of the policy engine itself.   This was chosen to promote flexibility as not every customer will have the same requirements around creating and managing admin quorums.
      operationId: createPolicy
      requestBody:
        required: true
        content:
          application/json:
            schema:
              oneOf:
                - type: object
                  properties:
                    name:
                      type: string
                    activityKind:
                      type: string
                      enum:
                        - Registry:Addresses:Modify
                    rule:
                      type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - AlwaysTrigger
                        configuration:
                          type: object
                          properties: {}
                          additionalProperties: false
                      required:
                        - kind
                      additionalProperties: false
                      description: >-
                        This rule will always be triggered, meaning that if this
                        rule is defined on a policy, the policy will always
                        trigger the policy action, regardless of the activity
                        details.
                      title: AlwaysTrigger
                    action:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - RequestApproval
                            approvalGroups:
                              type: array
                              items:
                                type: object
                                properties:
                                  name:
                                    type: string
                                  quorum:
                                    type: integer
                                    minimum: 1
                                  approvers:
                                    type: object
                                    properties:
                                      userId:
                                        type: object
                                        properties:
                                          in:
                                            type: array
                                            items:
                                              type: string
                                              minLength: 1
                                            minItems: 1
                                            maxItems: 100
                                        required:
                                          - in
                                        additionalProperties: false
                                    additionalProperties: false
                                  initiatorCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether the initiator of the activity can
                                      participate in the approval.
                                  serviceAccountsCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether service accounts can participate
                                      in the approval for this group.
                                required:
                                  - quorum
                                  - approvers
                                additionalProperties: false
                              minItems: 1
                            autoRejectTimeout:
                              type:
                                - integer
                                - 'null'
                              minimum: 1
                          required:
                            - kind
                            - approvalGroups
                          additionalProperties: false
                          description: >-

                            This action means that activity will first require
                            an Approval process to be completed before it can 
                            be executed (or be aborted if someone rejects it
                            during the approval process).


                            One or several groups of approvers need to be
                            specified. These groups define who is allowed to
                            approve / reject an activity.


                            The activity will only be executed if all approver
                            groups reach their "quorum" of approvals. Otherwise,
                            if any one user within any approver group rejects,
                            then the activity is aborted and the call is not
                            executed.


                            The example below shows a `RequestApproval` action,
                            configured with one approval group requiring 2
                            approvals amongst three specific users.


                            ```json

                            {
                              "action": {
                                "kind": "RequestApproval",
                                "autoRejectTimeout": 60, // minutes
                                "approvalGroups": [
                                  {
                                    "name": "Admins",
                                    "quorum": 2, // only 2 approvers required in that group 
                                    "approvers": {
                                      "userId": {
                                        "in": ["us-...1", "us-...2", "us-...3"],
                                      }
                                    }
                                  }
                                ],

                              }
                            }

                            ```


                            **Don't lock yourself up**


                            By default, users cannot approve an activity they
                            initiated themselves, even if they are in an
                            approval group. To allow this, you must set
                            `initiatorCanApprove: true`.


                            *Example 1:* For any wallet transfer, a policy is
                            setup to require approval from **1 specific admin
                            user** (eg. the CEO). `initiatorCanApprove` was not
                            set to `true`. If the CEO himself initiates a
                            transfer, no-one can approve his transfer and it's
                            stuck.


                            *Example 2:* Company has only 3 users. A policy is
                            setup to require approval from **any 3 users**
                            (`quorum: 3`) for any modification of a policy.
                            `initiatorCanApprove` was not set to `true`. In this
                            case, they are locked, and the policy cannot be
                            modified: whoever requests a modification cannot
                            approve, and the policy is therefore always missing
                            one approver. To unlock, they would need to invite a
                            new user and give him the rights to approve as well.
                                
                          title: RequestApproval
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Block
                          required:
                            - kind
                          additionalProperties: false
                          description: >
                            This action means that the activity will be blocked
                            if the policy is triggered.


                            ```json

                            {
                              "action": {
                                "kind": "Block"
                              }
                            }

                            ```
                          title: Block
                    filters:
                      type: object
                      properties: {}
                  required:
                    - name
                    - activityKind
                    - rule
                    - action
                  additionalProperties: false
                  description: ''
                  title: Registry:Addresses:Modify
                - type: object
                  properties:
                    name:
                      type: string
                    activityKind:
                      type: string
                      enum:
                        - Permissions:Assign
                    rule:
                      type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - AlwaysTrigger
                        configuration:
                          type: object
                          properties: {}
                          additionalProperties: false
                      required:
                        - kind
                      additionalProperties: false
                      description: >-
                        This rule will always be triggered, meaning that if this
                        rule is defined on a policy, the policy will always
                        trigger the policy action, regardless of the activity
                        details.
                      title: AlwaysTrigger
                    action:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - RequestApproval
                            approvalGroups:
                              type: array
                              items:
                                type: object
                                properties:
                                  name:
                                    type: string
                                  quorum:
                                    type: integer
                                    minimum: 1
                                  approvers:
                                    type: object
                                    properties:
                                      userId:
                                        type: object
                                        properties:
                                          in:
                                            type: array
                                            items:
                                              type: string
                                              minLength: 1
                                            minItems: 1
                                            maxItems: 100
                                        required:
                                          - in
                                        additionalProperties: false
                                    additionalProperties: false
                                  initiatorCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether the initiator of the activity can
                                      participate in the approval.
                                  serviceAccountsCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether service accounts can participate
                                      in the approval for this group.
                                required:
                                  - quorum
                                  - approvers
                                additionalProperties: false
                              minItems: 1
                            autoRejectTimeout:
                              type:
                                - integer
                                - 'null'
                              minimum: 1
                          required:
                            - kind
                            - approvalGroups
                          additionalProperties: false
                          description: >-

                            This action means that activity will first require
                            an Approval process to be completed before it can 
                            be executed (or be aborted if someone rejects it
                            during the approval process).


                            One or several groups of approvers need to be
                            specified. These groups define who is allowed to
                            approve / reject an activity.


                            The activity will only be executed if all approver
                            groups reach their "quorum" of approvals. Otherwise,
                            if any one user within any approver group rejects,
                            then the activity is aborted and the call is not
                            executed.


                            The example below shows a `RequestApproval` action,
                            configured with one approval group requiring 2
                            approvals amongst three specific users.


                            ```json

                            {
                              "action": {
                                "kind": "RequestApproval",
                                "autoRejectTimeout": 60, // minutes
                                "approvalGroups": [
                                  {
                                    "name": "Admins",
                                    "quorum": 2, // only 2 approvers required in that group 
                                    "approvers": {
                                      "userId": {
                                        "in": ["us-...1", "us-...2", "us-...3"],
                                      }
                                    }
                                  }
                                ],

                              }
                            }

                            ```


                            **Don't lock yourself up**


                            By default, users cannot approve an activity they
                            initiated themselves, even if they are in an
                            approval group. To allow this, you must set
                            `initiatorCanApprove: true`.


                            *Example 1:* For any wallet transfer, a policy is
                            setup to require approval from **1 specific admin
                            user** (eg. the CEO). `initiatorCanApprove` was not
                            set to `true`. If the CEO himself initiates a
                            transfer, no-one can approve his transfer and it's
                            stuck.


                            *Example 2:* Company has only 3 users. A policy is
                            setup to require approval from **any 3 users**
                            (`quorum: 3`) for any modification of a policy.
                            `initiatorCanApprove` was not set to `true`. In this
                            case, they are locked, and the policy cannot be
                            modified: whoever requests a modification cannot
                            approve, and the policy is therefore always missing
                            one approver. To unlock, they would need to invite a
                            new user and give him the rights to approve as well.
                                
                          title: RequestApproval
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Block
                          required:
                            - kind
                          additionalProperties: false
                          description: >
                            This action means that the activity will be blocked
                            if the policy is triggered.


                            ```json

                            {
                              "action": {
                                "kind": "Block"
                              }
                            }

                            ```
                          title: Block
                    filters:
                      type: object
                      properties:
                        permissionId:
                          type: object
                          properties:
                            in:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          required:
                            - in
                          additionalProperties: false
                      required:
                        - permissionId
                      additionalProperties: false
                  required:
                    - name
                    - activityKind
                    - rule
                    - action
                  additionalProperties: false
                  description: >-
                    A "`Permissions:Assign`" activity represents any activity
                    which involves assigning a permission (or revoking it, aka
                    "deleting a permission assignment"). These activities are
                    Assignment change requests, created as a result of calling
                    either:


                    * the endpoint [Assign
                    Permission](https://docs.dfns.co/api-reference/permissions/assign-permission)

                    * the endpoint [Revoke
                    Permission](https://docs.dfns.co/api-reference/permissions/revoke-permission)
                  title: Permissions:Assign
                - type: object
                  properties:
                    name:
                      type: string
                    activityKind:
                      type: string
                      enum:
                        - Permissions:Modify
                    rule:
                      type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - AlwaysTrigger
                        configuration:
                          type: object
                          properties: {}
                          additionalProperties: false
                      required:
                        - kind
                      additionalProperties: false
                      description: >-
                        This rule will always be triggered, meaning that if this
                        rule is defined on a policy, the policy will always
                        trigger the policy action, regardless of the activity
                        details.
                      title: AlwaysTrigger
                    action:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - RequestApproval
                            approvalGroups:
                              type: array
                              items:
                                type: object
                                properties:
                                  name:
                                    type: string
                                  quorum:
                                    type: integer
                                    minimum: 1
                                  approvers:
                                    type: object
                                    properties:
                                      userId:
                                        type: object
                                        properties:
                                          in:
                                            type: array
                                            items:
                                              type: string
                                              minLength: 1
                                            minItems: 1
                                            maxItems: 100
                                        required:
                                          - in
                                        additionalProperties: false
                                    additionalProperties: false
                                  initiatorCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether the initiator of the activity can
                                      participate in the approval.
                                  serviceAccountsCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether service accounts can participate
                                      in the approval for this group.
                                required:
                                  - quorum
                                  - approvers
                                additionalProperties: false
                              minItems: 1
                            autoRejectTimeout:
                              type:
                                - integer
                                - 'null'
                              minimum: 1
                          required:
                            - kind
                            - approvalGroups
                          additionalProperties: false
                          description: >-

                            This action means that activity will first require
                            an Approval process to be completed before it can 
                            be executed (or be aborted if someone rejects it
                            during the approval process).


                            One or several groups of approvers need to be
                            specified. These groups define who is allowed to
                            approve / reject an activity.


                            The activity will only be executed if all approver
                            groups reach their "quorum" of approvals. Otherwise,
                            if any one user within any approver group rejects,
                            then the activity is aborted and the call is not
                            executed.


                            The example below shows a `RequestApproval` action,
                            configured with one approval group requiring 2
                            approvals amongst three specific users.


                            ```json

                            {
                              "action": {
                                "kind": "RequestApproval",
                                "autoRejectTimeout": 60, // minutes
                                "approvalGroups": [
                                  {
                                    "name": "Admins",
                                    "quorum": 2, // only 2 approvers required in that group 
                                    "approvers": {
                                      "userId": {
                                        "in": ["us-...1", "us-...2", "us-...3"],
                                      }
                                    }
                                  }
                                ],

                              }
                            }

                            ```


                            **Don't lock yourself up**


                            By default, users cannot approve an activity they
                            initiated themselves, even if they are in an
                            approval group. To allow this, you must set
                            `initiatorCanApprove: true`.


                            *Example 1:* For any wallet transfer, a policy is
                            setup to require approval from **1 specific admin
                            user** (eg. the CEO). `initiatorCanApprove` was not
                            set to `true`. If the CEO himself initiates a
                            transfer, no-one can approve his transfer and it's
                            stuck.


                            *Example 2:* Company has only 3 users. A policy is
                            setup to require approval from **any 3 users**
                            (`quorum: 3`) for any modification of a policy.
                            `initiatorCanApprove` was not set to `true`. In this
                            case, they are locked, and the policy cannot be
                            modified: whoever requests a modification cannot
                            approve, and the policy is therefore always missing
                            one approver. To unlock, they would need to invite a
                            new user and give him the rights to approve as well.
                                
                          title: RequestApproval
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Block
                          required:
                            - kind
                          additionalProperties: false
                          description: >
                            This action means that the activity will be blocked
                            if the policy is triggered.


                            ```json

                            {
                              "action": {
                                "kind": "Block"
                              }
                            }

                            ```
                          title: Block
                    filters:
                      type: object
                      properties:
                        permissionId:
                          type: object
                          properties:
                            in:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          required:
                            - in
                          additionalProperties: false
                      required:
                        - permissionId
                      additionalProperties: false
                  required:
                    - name
                    - activityKind
                    - rule
                    - action
                  additionalProperties: false
                  description: >-
                    A "`Permissions:Modify`" activity represents any activity
                    which involves updating or archiving a permission. These
                    activities are Permission change requests, created as a
                    result of calling either:


                    * the endpoint [Update
                    Permission](https://docs.dfns.co/api-reference/permissions/update-permission)

                    * the endpoint [Delete
                    Permission](https://docs.dfns.co/api-reference/permissions/archive-permission)
                  title: Permissions:Modify
                - type: object
                  properties:
                    name:
                      type: string
                    activityKind:
                      type: string
                      enum:
                        - Policies:Modify
                    rule:
                      type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - AlwaysTrigger
                        configuration:
                          type: object
                          properties: {}
                          additionalProperties: false
                      required:
                        - kind
                      additionalProperties: false
                      description: >-
                        This rule will always be triggered, meaning that if this
                        rule is defined on a policy, the policy will always
                        trigger the policy action, regardless of the activity
                        details.
                      title: AlwaysTrigger
                    action:
                      type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - RequestApproval
                        approvalGroups:
                          type: array
                          items:
                            type: object
                            properties:
                              name:
                                type: string
                              quorum:
                                type: integer
                                minimum: 1
                              approvers:
                                type: object
                                properties:
                                  userId:
                                    type: object
                                    properties:
                                      in:
                                        type: array
                                        items:
                                          type: string
                                          minLength: 1
                                        minItems: 1
                                        maxItems: 100
                                    required:
                                      - in
                                    additionalProperties: false
                                additionalProperties: false
                              initiatorCanApprove:
                                type: boolean
                                description: >-
                                  Whether the initiator of the activity can
                                  participate in the approval.
                              serviceAccountsCanApprove:
                                type: boolean
                                description: >-
                                  Whether service accounts can participate in
                                  the approval for this group.
                            required:
                              - quorum
                              - approvers
                            additionalProperties: false
                          minItems: 1
                        autoRejectTimeout:
                          type:
                            - integer
                            - 'null'
                          minimum: 1
                      required:
                        - kind
                        - approvalGroups
                      additionalProperties: false
                      description: >-

                        This action means that activity will first require an
                        Approval process to be completed before it can  be
                        executed (or be aborted if someone rejects it during the
                        approval process).


                        One or several groups of approvers need to be specified.
                        These groups define who is allowed to approve / reject
                        an activity.


                        The activity will only be executed if all approver
                        groups reach their "quorum" of approvals. Otherwise, if
                        any one user within any approver group rejects, then the
                        activity is aborted and the call is not executed.


                        The example below shows a `RequestApproval` action,
                        configured with one approval group requiring 2 approvals
                        amongst three specific users.


                        ```json

                        {
                          "action": {
                            "kind": "RequestApproval",
                            "autoRejectTimeout": 60, // minutes
                            "approvalGroups": [
                              {
                                "name": "Admins",
                                "quorum": 2, // only 2 approvers required in that group 
                                "approvers": {
                                  "userId": {
                                    "in": ["us-...1", "us-...2", "us-...3"],
                                  }
                                }
                              }
                            ],

                          }
                        }

                        ```


                        **Don't lock yourself up**


                        By default, users cannot approve an activity they
                        initiated themselves, even if they are in an approval
                        group. To allow this, you must set `initiatorCanApprove:
                        true`.


                        *Example 1:* For any wallet transfer, a policy is setup
                        to require approval from **1 specific admin user** (eg.
                        the CEO). `initiatorCanApprove` was not set to `true`.
                        If the CEO himself initiates a transfer, no-one can
                        approve his transfer and it's stuck.


                        *Example 2:* Company has only 3 users. A policy is setup
                        to require approval from **any 3 users** (`quorum: 3`)
                        for any modification of a policy. `initiatorCanApprove`
                        was not set to `true`. In this case, they are locked,
                        and the policy cannot be modified: whoever requests a
                        modification cannot approve, and the policy is therefore
                        always missing one approver. To unlock, they would need
                        to invite a new user and give him the rights to approve
                        as well.
                            
                      title: RequestApproval
                    filters:
                      type: object
                      properties:
                        policyId:
                          type: object
                          properties:
                            in:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          required:
                            - in
                          additionalProperties: false
                      required:
                        - policyId
                      additionalProperties: false
                  required:
                    - name
                    - activityKind
                    - rule
                    - action
                  additionalProperties: false
                  description: >
                    A "`Policies:Modify`" activity represents any activity which
                    involves updating or archiving a policy. These activities
                    are Policy change requests, created as a result of calling
                    either:


                    * the endpoint [Update
                    Policy](https://docs.dfns.co/api-reference/policies/update-policy)

                    * the endpoint [Delete
                    Policy](https://docs.dfns.co/api-reference/policies/delete-policy)
                  title: Policies:Modify
                - type: object
                  properties:
                    name:
                      type: string
                    activityKind:
                      type: string
                      enum:
                        - Registry:ContractSchemas:Modify
                    rule:
                      type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - AlwaysTrigger
                        configuration:
                          type: object
                          properties: {}
                          additionalProperties: false
                      required:
                        - kind
                      additionalProperties: false
                      description: >-
                        This rule will always be triggered, meaning that if this
                        rule is defined on a policy, the policy will always
                        trigger the policy action, regardless of the activity
                        details.
                      title: AlwaysTrigger
                    action:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - RequestApproval
                            approvalGroups:
                              type: array
                              items:
                                type: object
                                properties:
                                  name:
                                    type: string
                                  quorum:
                                    type: integer
                                    minimum: 1
                                  approvers:
                                    type: object
                                    properties:
                                      userId:
                                        type: object
                                        properties:
                                          in:
                                            type: array
                                            items:
                                              type: string
                                              minLength: 1
                                            minItems: 1
                                            maxItems: 100
                                        required:
                                          - in
                                        additionalProperties: false
                                    additionalProperties: false
                                  initiatorCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether the initiator of the activity can
                                      participate in the approval.
                                  serviceAccountsCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether service accounts can participate
                                      in the approval for this group.
                                required:
                                  - quorum
                                  - approvers
                                additionalProperties: false
                              minItems: 1
                            autoRejectTimeout:
                              type:
                                - integer
                                - 'null'
                              minimum: 1
                          required:
                            - kind
                            - approvalGroups
                          additionalProperties: false
                          description: >-

                            This action means that activity will first require
                            an Approval process to be completed before it can 
                            be executed (or be aborted if someone rejects it
                            during the approval process).


                            One or several groups of approvers need to be
                            specified. These groups define who is allowed to
                            approve / reject an activity.


                            The activity will only be executed if all approver
                            groups reach their "quorum" of approvals. Otherwise,
                            if any one user within any approver group rejects,
                            then the activity is aborted and the call is not
                            executed.


                            The example below shows a `RequestApproval` action,
                            configured with one approval group requiring 2
                            approvals amongst three specific users.


                            ```json

                            {
                              "action": {
                                "kind": "RequestApproval",
                                "autoRejectTimeout": 60, // minutes
                                "approvalGroups": [
                                  {
                                    "name": "Admins",
                                    "quorum": 2, // only 2 approvers required in that group 
                                    "approvers": {
                                      "userId": {
                                        "in": ["us-...1", "us-...2", "us-...3"],
                                      }
                                    }
                                  }
                                ],

                              }
                            }

                            ```


                            **Don't lock yourself up**


                            By default, users cannot approve an activity they
                            initiated themselves, even if they are in an
                            approval group. To allow this, you must set
                            `initiatorCanApprove: true`.


                            *Example 1:* For any wallet transfer, a policy is
                            setup to require approval from **1 specific admin
                            user** (eg. the CEO). `initiatorCanApprove` was not
                            set to `true`. If the CEO himself initiates a
                            transfer, no-one can approve his transfer and it's
                            stuck.


                            *Example 2:* Company has only 3 users. A policy is
                            setup to require approval from **any 3 users**
                            (`quorum: 3`) for any modification of a policy.
                            `initiatorCanApprove` was not set to `true`. In this
                            case, they are locked, and the policy cannot be
                            modified: whoever requests a modification cannot
                            approve, and the policy is therefore always missing
                            one approver. To unlock, they would need to invite a
                            new user and give him the rights to approve as well.
                                
                          title: RequestApproval
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Block
                          required:
                            - kind
                          additionalProperties: false
                          description: >
                            This action means that the activity will be blocked
                            if the policy is triggered.


                            ```json

                            {
                              "action": {
                                "kind": "Block"
                              }
                            }

                            ```
                          title: Block
                    filters:
                      type: object
                      properties: {}
                  required:
                    - name
                    - activityKind
                    - rule
                    - action
                  additionalProperties: false
                  description: >-
                    A "`Registry:ContractSchemas:Modify`" activity represents
                    any activity which modifies a Contract Schema registered for
                    execution in the Dfns Dashboard
                  title: Registry:ContractSchemas:Modify
                - type: object
                  properties:
                    name:
                      type: string
                    activityKind:
                      type: string
                      enum:
                        - Wallets:Sign
                    rule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - AlwaysTrigger
                            configuration:
                              type: object
                              properties: {}
                              additionalProperties: false
                          required:
                            - kind
                          additionalProperties: false
                          description: >-
                            This rule will always be triggered, meaning that if
                            this rule is defined on a policy, the policy will
                            always trigger the policy action, regardless of the
                            activity details.
                          title: AlwaysTrigger
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - TransactionRecipientWhitelist
                            configuration:
                              type: object
                              properties:
                                addresses:
                                  type: array
                                  items:
                                    type: string
                                    minLength: 1
                                  description: Whitelisted recipient addresses
                              required:
                                - addresses
                              additionalProperties: false
                          required:
                            - kind
                            - configuration
                          additionalProperties: false
                          description: >-
                            This rule will trigger if the destination address
                            *is NOT whitelisted*.
                          title: TransactionRecipientWhitelist
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - TransactionAmountLimit
                            configuration:
                              type: object
                              properties:
                                limit:
                                  type: number
                                  description: Amount limit in `currency`
                                currency:
                                  type: string
                                  enum:
                                    - USD
                                  description: Fiat currency, currently only `USD`
                              required:
                                - limit
                                - currency
                              additionalProperties: false
                          required:
                            - kind
                            - configuration
                          additionalProperties: false
                          description: >-
                            This rule will trigger if the wallet activity
                            detected is transferring some value which amount is
                            greater than a given limit.


                            The limit is expressed in a fiat `currency` and
                            evaluated against the market value of the transfer.
                            To set a threshold in the asset's own units instead,
                            use `TransactionAmountLimitNominal`.


                            Note: If the amount of the wallet activity cannot be
                            evaluated for any reason (eg. market prices are not
                            available, or eg. the amount cannot be inferred from
                            a wallet signature request, etc.), by default the
                            rule will trigger the policy (this is called
                            "failing closed" and is generally considered a
                            security best practice).
                          title: TransactionAmountLimit
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - TransactionAmountLimitNominal
                            configuration:
                              type: object
                              properties:
                                assets:
                                  type: array
                                  items:
                                    type: object
                                    properties:
                                      network:
                                        allOf:
                                          - $ref: '#/components/schemas/Network'
                                          - description: The network the asset lives on.
                                      tid:
                                        type: string
                                        minLength: 1
                                        maxLength: 200
                                        pattern: ^[a-z0-9_]+:[^\s](?:[ ]?[^\s])*$
                                        description: >-
                                          The Dfns token identifier of the asset,
                                          for example `native:eth` or
                                          `erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`.
                                          Must be canonical: token contract
                                          addresses on hex based networks are
                                          lower cased.
                                      limit:
                                        type: string
                                        pattern: ^\d+$
                                        description: >-
                                          Amount limit in the minimum denomination
                                          of the asset, as an integer string,
                                          matching how a transfer expresses its
                                          amount. For an 18 decimal token
                                          `"5000000000000000000"` is 5 whole
                                          tokens.
                                    required:
                                      - network
                                      - tid
                                      - limit
                                    additionalProperties: false
                                  minItems: 1
                                  maxItems: 100
                                  description: >-
                                    The assets this rule applies to, each with
                                    its own limit. A transfer of an asset that
                                    is not listed does not trigger the rule. The
                                    limit applies to each matching transfer
                                    individually; nothing is accumulated across
                                    transfers.
                              required:
                                - assets
                              additionalProperties: false
                          required:
                            - kind
                            - configuration
                          additionalProperties: false
                          description: >-
                            This rule will trigger if the wallet activity
                            detected is transferring more of a listed asset than
                            that asset's limit.


                            Each limit is expressed in the minimum denomination
                            of its own asset and compared against the
                            transferred amount directly, so the verdict needs no
                            market data and does not move with a price. To set a
                            threshold on the fiat value of a transfer instead,
                            use `TransactionAmountLimit`.


                            Limits are asset exact: an asset is identified by
                            its network and its Dfns token identifier, so a
                            wrapped or staked derivative is a different asset
                            from the thing it tracks, and a transfer of an asset
                            the rule does not list will not trigger it.


                            Note: If the transferred amount or the asset cannot
                            be determined for any reason, by default the rule
                            will trigger the policy (this is called "failing
                            closed" and is generally considered a security best
                            practice).
                          title: TransactionAmountLimitNominal
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - TransactionAmountVelocity
                            configuration:
                              type: object
                              properties:
                                limit:
                                  type: number
                                  description: Amount limit in `currency`
                                currency:
                                  type: string
                                  enum:
                                    - USD
                                  description: Currency for the amount limit above
                                timeframe:
                                  type: integer
                                  minimum: 1
                                  maximum: 43200
                                  description: >-
                                    Time period in minutes. Minimum 1, Maximum
                                    43,200.
                              required:
                                - limit
                                - currency
                                - timeframe
                              additionalProperties: false
                          required:
                            - kind
                            - configuration
                          additionalProperties: false
                          description: >-
                            This rule will trigger if the cumulative amount
                            transferred from a given wallet within a given
                            timeframe is greater than a specified limit.  The
                            aggregate amount evaluated is based only on the
                            wallet that triggered the policy.
                          title: TransactionAmountVelocity
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - TransactionCountVelocity
                            configuration:
                              type: object
                              properties:
                                limit:
                                  type: number
                                  description: Count limit
                                timeframe:
                                  type: integer
                                  minimum: 1
                                  maximum: 43200
                                  description: >-
                                    Time period in minutes. Minimum 1, Maximum
                                    43,200.
                              required:
                                - limit
                                - timeframe
                              additionalProperties: false
                          required:
                            - kind
                            - configuration
                          additionalProperties: false
                          description: >-
                            This rule will trigger if the number of wallet
                            activities for a given wallet within a given
                            timeframe, is greater than a specified limit. The
                            aggregate number of transactions evaluated is based
                            only on the wallet that triggered the policy.
                          title: TransactionCountVelocity
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - ChainalysisTransactionPrescreening
                            configuration:
                              type: object
                              properties:
                                alerts:
                                  type: object
                                  properties:
                                    alertLevel:
                                      type: string
                                      enum:
                                        - LOW
                                        - MEDIUM
                                        - HIGH
                                        - SEVERE
                                    categoryIds:
                                      type: array
                                      items:
                                        type: integer
                                        exclusiveMinimum: 0
                                  required:
                                    - alertLevel
                                    - categoryIds
                                exposures:
                                  type: object
                                  properties:
                                    direct:
                                      type: object
                                      properties:
                                        categoryIds:
                                          type: array
                                          items:
                                            type: integer
                                            exclusiveMinimum: 0
                                      required:
                                        - categoryIds
                                  required:
                                    - direct
                                addresses:
                                  type: object
                                  properties:
                                    categoryIds:
                                      type: array
                                      items:
                                        type: integer
                                        exclusiveMinimum: 0
                                  required:
                                    - categoryIds
                                userIdTemplate:
                                  type: string
                                  minLength: 1
                                  maxLength: 50
                                  pattern: >-
                                    ^([a-zA-Z0-9_:-]|{wallet\.id}|{wallet\.externalId})+$
                                  default: dfns
                                  description: >-
                                    **Deprecated** — set `userIdTemplate` on the
                                    Chainalysis integration setting instead;
                                    when set there, the integration-level
                                    template takes precedence over this one.


                                    Value sent to Chainalysis as the "user ID".
                                    Used by Chainalysis for grouping transaction
                                    screenings.
                                      
                                    This template can include variables,
                                    included in brackets. The following
                                    variables are currently supported: 
                                    `{wallet.id}` and `{wallet.externalId}`.

                                    As an example, if you set `userIdTemplate:
                                    "dfns:{wallet.id}_{wallet.externalId}"`,
                                    when your wallet receives a transaction that
                                    gets screened by a Chainalysis policy, the
                                    "user ID" sent to Chainalysis will be
                                    `dfns:wa-xxx_yyy` (`wa-xxx` being the wallet
                                    ID, and `yyy` being the wallet external ID).
                                fallbackBehaviours:
                                  type: object
                                  properties:
                                    skipUnscreenableTransaction:
                                      type: boolean
                                    skipUnsupportedNetwork:
                                      type: boolean
                                    skipUnsupportedAsset:
                                      type: boolean
                                    skipChainalysisFailure:
                                      type: boolean
                                  required:
                                    - skipUnscreenableTransaction
                                    - skipUnsupportedNetwork
                                    - skipUnsupportedAsset
                                    - skipChainalysisFailure
                              required:
                                - alerts
                                - exposures
                                - addresses
                                - fallbackBehaviours
                              additionalProperties: false
                          required:
                            - kind
                            - configuration
                          additionalProperties: false
                          description: >+

                            <Info>

                            This rule can only be used once the Chainalysis
                            integration is activated from the Dfns dashboard
                            settings. (see more on
                            [Chainalysis](https://docs.dfns.co/integrations/aml-kyt/chainalysis)
                            integration page).

                            </Info>


                            It's a rule based on
                            [Chainalysis](https://docs.dfns.co/integrations/aml-kyt/chainalysis)
                            KYT integration (Know-Your-Transaction). Upon
                            transfer attempt, we will first register the
                            transfer with Chainalysis (as a ["withdrawal
                            attempt"](https://docs.chainalysis.com/api/kyt/#registration-register-a-withdrawal-attempt)),
                            and fetch the screening results (alerts, exposures,
                            addresses detected). Based on the results, and the
                            configuration of this rule, the policy will be
                            triggered.


                            It's called "Pre"-screening, because the scanned
                            transaction is not on chain yet, it's still a
                            transaction attempt (before the transaction actually
                            make it on chain).


                            ```json

                            {
                              "rule": {
                                "kind": "ChainalysisTransactionPrescreening",
                                "configuration": {
                                  "alerts": {
                                    "alertLevel": "LOW",
                                    "categoryIds": []
                                  },
                                  "exposures": {
                                    "direct": {
                                      "categoryIds": []
                                    }
                                  },
                                  "addresses": {
                                    "categoryIds": []
                                  },
                                  "fallbackBehaviours": {
                                    "skipUnscreenableTransaction": false,
                                    "skipUnsupportedNetwork": false,
                                    "skipUnsupportedAsset": false,
                                    "skipChainalysisFailure": false
                                  }
                                }
                              }
                            }

                            ```


                            **Configuration**


                            | Property | Type | Description |

                            | --- | --- | --- |

                            | `alerts`<br><br>`.alertLevel`* | `string` |
                            Minimum alert level above which the rule should
                            trigger, if any [alert is returned in Chainalysis
                            results](https://docs.chainalysis.com/api/kyt/#withdrawal-attempts-get-alerts).
                            Can be `LOW`, `MEDIUM`, `HIGH`, or `SEVERE` |

                            | `alerts`<br><br>`.categoryIds`* | list of integers
                            | List of Chainalysis category IDs (see
                            [here](https://docs.chainalysis.com/api/kyt/#categories)).
                            If you leave this list empty, alerts of any category
                            will trigger the rule. Otherwise, if you only want
                            the rule to trigger on specific categories, you can
                            specify some in the list. |

                            |
                            `exposures`<br><br>`.direct`<br><br>`.categoryIds`*
                            | list of integers | List of Chainalysis category
                            IDs (see
                            [here](https://docs.chainalysis.com/api/kyt/#categories)).
                            If you leave this list empty, a [direct
                            exposure](https://docs.chainalysis.com/api/kyt/#withdrawal-attempts-get-direct-exposure)
                            of any category detected by chainalysis will trigger
                            the rule. Otherwise, if you only want the rule to
                            trigger on specific categories, you can specify some
                            in the list. |

                            | `addresses`<br><br>`.categoryIds`* | list of
                            integers | List of Chainalysis category IDs (see
                            [here](https://docs.chainalysis.com/api/kyt/#categories)).
                            If you leave this list empty, an
                            [address](https://docs.chainalysis.com/api/kyt/#withdrawal-attempts-get-address-identifications)
                            of any category identified by chainalysis will
                            trigger the rule. Otherwise, if you only want the
                            rule to trigger on specific categories, you can
                            specify some in the list. |

                            |
                            `fallbackBehaviours`<br><br>`.skipUnscreenableTransaction`*
                            | boolean | Behaviour if the wallet activity is not
                            screenable (eg. if it's a signature request of a
                            hash). If true, a transaction which is
                            "unscreenable" will just be skipped, and policy will
                            not trigger |

                            | `fallbackBehaviours.skipUnsupportedNetwork`* |
                            boolean | Behaviour if the wallet activity is on a
                            network not supported by chainalysis, or not yet
                            supported in the dfns-chainalysis integration. If
                            true, an unsupported network will just be skipped,
                            and policy will not trigger |

                            | `fallbackBehaviours.skipUnsupportedAsset`* |
                            boolean | Behaviour if the wallet activity is with a
                            asset not supported by chainalysis, or not yet
                            supported in the dfns-chainalysis integration. If
                            true, an unsupported asset will just be skipped, and
                            policy will not trigger |

                            | `fallbackBehaviours.skipChainalysisFailure`* |
                            boolean | Behaviour if any issue with Chainalysis
                            calls (timeout, results took too long, rate limiting
                            errors, any error). If true, will skip if any error
                            happens |

                          title: ChainalysisTransactionPrescreening
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - EllipticTransactionPrescreening
                            configuration:
                              type: object
                              properties:
                                riskScoreThreshold:
                                  type: number
                                  minimum: 0
                                  maximum: 10
                                  description: >-
                                    Risk score threshold (0-10, decimals
                                    allowed). The policy triggers if the
                                    Elliptic risk score is at or above the
                                    threshold.
                                triggeredRules:
                                  type: object
                                  properties:
                                    ruleIds:
                                      type: array
                                      items:
                                        type: string
                                        format: uuid
                                      description: >-
                                        IDs of risk rules from your Elliptic
                                        risk model. If any of these rules
                                        matched the analysis, the policy
                                        triggers regardless of the risk score.
                                        Leave empty to trigger on the risk score
                                        threshold only.
                                    categories:
                                      type: array
                                      items:
                                        type: string
                                        minLength: 1
                                      description: >-
                                        Elliptic category names (eg. "Dark
                                        Market"), matched case-insensitively. If
                                        a matched risk rule involves any of
                                        these categories, the policy triggers
                                        regardless of the risk score. Leave
                                        empty to trigger on the risk score
                                        threshold only.
                                  required:
                                    - ruleIds
                                    - categories
                                fallbackBehaviours:
                                  type: object
                                  properties:
                                    skipUnscreenableTransaction:
                                      type: boolean
                                      description: >-
                                        skip all wallet requests that cannot be
                                        screened (eg. raw signatures)
                                    skipUnsupportedNetwork:
                                      type: boolean
                                      description: >-
                                        skip requests on a network not supported
                                        yet in our Elliptic integration
                                    skipEllipticFailure:
                                      type: boolean
                                      description: >-
                                        skip any failure of the Elliptic
                                        analysis (timeout, rate limiting, any
                                        error)
                                  required:
                                    - skipUnscreenableTransaction
                                    - skipUnsupportedNetwork
                                    - skipEllipticFailure
                              required:
                                - riskScoreThreshold
                                - triggeredRules
                                - fallbackBehaviours
                              additionalProperties: false
                          required:
                            - kind
                            - configuration
                          additionalProperties: false
                          description: >-

                            <Info>

                            This rule can only be used once the Elliptic
                            integration is activated from the Dfns dashboard
                            settings.

                            </Info>


                            This rule uses Elliptic KYT for pre-screening
                            outgoing transfers. Upon transfer attempt, we run a
                            synchronous Elliptic wallet analysis of the
                            destination address, and check the returned risk
                            score against the configured threshold, plus any
                            configured risk rules / categories. If at or above
                            the threshold, or if a configured rule / category
                            matched, the policy is triggered.


                            It's called "Pre"-screening, because the scanned
                            transaction is not on chain yet, it's still a
                            transaction attempt.
                          title: EllipticTransactionPrescreening
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - GlobalLedgerTransactionPrescreening
                            configuration:
                              type: object
                              properties:
                                riskScoreThreshold:
                                  type: integer
                                  minimum: 0
                                  maximum: 100
                                  description: >-
                                    Risk score threshold (0-100). Policy
                                    triggers if address/transaction risk score
                                    >= threshold
                                fallbackBehaviours:
                                  type: object
                                  properties:
                                    skipUnscreenableTransaction:
                                      type: boolean
                                      description: >-
                                        skip all wallet requests that cannot be
                                        screened (eg. raw signatures)
                                    skipUnsupportedNetwork:
                                      type: boolean
                                      description: >-
                                        skip transfer requests to a network not
                                        supported yet in our GlobalLedger
                                        integration
                                    skipUnsupportedAsset:
                                      type: boolean
                                      description: >-
                                        skip transfer requests of an asset not
                                        supported by our GlobalLedger
                                        integration
                                    skipGlobalLedgerFailure:
                                      type: boolean
                                      description: >-
                                        skips any errors from GlobalLedger API
                                        request
                                  required:
                                    - skipUnscreenableTransaction
                                    - skipUnsupportedNetwork
                                    - skipUnsupportedAsset
                                    - skipGlobalLedgerFailure
                              required:
                                - riskScoreThreshold
                                - fallbackBehaviours
                              additionalProperties: false
                          required:
                            - kind
                            - configuration
                          additionalProperties: false
                          description: >-
                            This rule uses GlobalLedger KYT for pre-screening
                            outgoing transfers by checking the destination
                            address risk score.


                            Upon transfer attempt, we will query GlobalLedger's
                            address risk API, and check if the risk score
                            (0-100) is at or above the configured threshold, or
                            if any alerts show up. If so, the policy will be
                            triggered.


                            It's called "Pre"-screening, because the scanned
                            transaction is not on chain yet, it's still a
                            transaction attempt.
                          title: GlobalLedgerTransactionPrescreening
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - TravelRuleTransactionPrescreening
                            configuration:
                              oneOf:
                                - type: object
                                  properties:
                                    vendor:
                                      type: string
                                      enum:
                                        - Notabene
                                    autoTriggerTimeoutSeconds:
                                      type: integer
                                      minimum: 0
                                    autoClearAfterDeliveredTimeoutSeconds:
                                      type: integer
                                      minimum: 0
                                  required:
                                    - vendor
                                    - autoTriggerTimeoutSeconds
                                  additionalProperties: false
                                  title: TravelRuleNotabeneConfiguration
                                - type: object
                                  properties:
                                    vendor:
                                      type: string
                                      enum:
                                        - Sumsub
                                    autoTriggerTimeoutSeconds:
                                      type: integer
                                      minimum: 0
                                  required:
                                    - vendor
                                    - autoTriggerTimeoutSeconds
                                  additionalProperties: false
                                  title: TravelRuleSumsubConfiguration
                          required:
                            - kind
                            - configuration
                          additionalProperties: false
                          description: >-
                            This rule can only be used once the Notabene
                            integration is activated from the Dfns dashboard
                            settings (see more on
                            [Notabene](https://docs.dfns.co/integrations/travel-rule/notabene)
                            integration page).
                                
                                It's a rule based on [Notabene Travel Rule](https://docs.dfns.co/integrations/travel-rule/notabene) integration. It ***ONLY*** applies to Dfns [Transfer Asset](https://docs.dfns.co/api-reference/wallets/transfer-asset) Api Calls. It is NOT supported for Transfers initiated via the dashboard. Upon transfer attempt with an optional [TravelRule](https://docs.dfns.co/api-reference/wallets/transfer-asset#body-travel-rule) payload, we will call Notabene's APIs on your behalf to both confirm the validity of the travel rule message and submit it for processing. Dfns then waits for a response from the counterparty (for custodial transfers) or Notabene (for non-custodial transfers).

                            The travel-rule vendor is determined by this rule's
                            `configuration.vendor`, and the transfer's
                            `travelRule` payload must be of the matching kind —
                            a mismatch blocks the transfer. Because of this, a
                            given wallet must be covered by travel-rule policies
                            of a single vendor: scoping two travel-rule policies
                            of different vendors to the same wallet would block
                            every transfer to it (whichever payload is sent
                            always mismatches the other vendor's rule).


                            It's called "Pre"-screening, because the transaction
                            is not on chain yet, it's still a transaction
                            attempt (before the transaction actually make it on
                            chain).
                          title: TravelRuleTransactionPrescreening
                    action:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - RequestApproval
                            approvalGroups:
                              type: array
                              items:
                                type: object
                                properties:
                                  name:
                                    type: string
                                  quorum:
                                    type: integer
                                    minimum: 1
                                  approvers:
                                    type: object
                                    properties:
                                      userId:
                                        type: object
                                        properties:
                                          in:
                                            type: array
                                            items:
                                              type: string
                                              minLength: 1
                                            minItems: 1
                                            maxItems: 100
                                        required:
                                          - in
                                        additionalProperties: false
                                    additionalProperties: false
                                  initiatorCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether the initiator of the activity can
                                      participate in the approval.
                                  serviceAccountsCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether service accounts can participate
                                      in the approval for this group.
                                required:
                                  - quorum
                                  - approvers
                                additionalProperties: false
                              minItems: 1
                            autoRejectTimeout:
                              type:
                                - integer
                                - 'null'
                              minimum: 1
                          required:
                            - kind
                            - approvalGroups
                          additionalProperties: false
                          description: >-

                            This action means that activity will first require
                            an Approval process to be completed before it can 
                            be executed (or be aborted if someone rejects it
                            during the approval process).


                            One or several groups of approvers need to be
                            specified. These groups define who is allowed to
                            approve / reject an activity.


                            The activity will only be executed if all approver
                            groups reach their "quorum" of approvals. Otherwise,
                            if any one user within any approver group rejects,
                            then the activity is aborted and the call is not
                            executed.


                            The example below shows a `RequestApproval` action,
                            configured with one approval group requiring 2
                            approvals amongst three specific users.


                            ```json

                            {
                              "action": {
                                "kind": "RequestApproval",
                                "autoRejectTimeout": 60, // minutes
                                "approvalGroups": [
                                  {
                                    "name": "Admins",
                                    "quorum": 2, // only 2 approvers required in that group 
                                    "approvers": {
                                      "userId": {
                                        "in": ["us-...1", "us-...2", "us-...3"],
                                      }
                                    }
                                  }
                                ],

                              }
                            }

                            ```


                            **Don't lock yourself up**


                            By default, users cannot approve an activity they
                            initiated themselves, even if they are in an
                            approval group. To allow this, you must set
                            `initiatorCanApprove: true`.


                            *Example 1:* For any wallet transfer, a policy is
                            setup to require approval from **1 specific admin
                            user** (eg. the CEO). `initiatorCanApprove` was not
                            set to `true`. If the CEO himself initiates a
                            transfer, no-one can approve his transfer and it's
                            stuck.


                            *Example 2:* Company has only 3 users. A policy is
                            setup to require approval from **any 3 users**
                            (`quorum: 3`) for any modification of a policy.
                            `initiatorCanApprove` was not set to `true`. In this
                            case, they are locked, and the policy cannot be
                            modified: whoever requests a modification cannot
                            approve, and the policy is therefore always missing
                            one approver. To unlock, they would need to invite a
                            new user and give him the rights to approve as well.
                                
                          title: RequestApproval
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Block
                          required:
                            - kind
                          additionalProperties: false
                          description: >
                            This action means that the activity will be blocked
                            if the policy is triggered.


                            ```json

                            {
                              "action": {
                                "kind": "Block"
                              }
                            }

                            ```
                          title: Block
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - NoAction
                          required:
                            - kind
                          additionalProperties: false
                          description: |2-

                                This action kind means that nothing will happen after policy rule evaluation. It's meant to be used with policy rules "`ChainalysisTransactionPrescreening`" or "`ChainalysisTransactionScreening`". This action is for when you just want the KYT analysis rule to be run, and then if triggered, those result returned in a `policy.triggered` [Webhook Event](https://docs.dfns.co/api-reference/webhook-events).

                            ```json
                            {
                              "action": {
                                "kind": "NoAction"
                              }
                            }
                            ```
                                
                          title: NoAction
                    filters:
                      type: object
                      properties:
                        walletId:
                          type: object
                          properties:
                            in:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          required:
                            - in
                          additionalProperties: false
                        walletTags:
                          type: object
                          properties:
                            hasAny:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                            hasAll:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          additionalProperties: false
                      additionalProperties: false
                  required:
                    - name
                    - activityKind
                    - rule
                    - action
                  additionalProperties: false
                  description: >
                    A "`Wallets:Sign`" activity represents any activity which
                    involves signing with a wallet. Currently, in our API, these
                    can be:


                    * a Transfer Request (created using the endpoint [Transfer
                    Asset from
                    Wallet](https://docs.dfns.co/api-reference/wallets/transfer-asset))

                    * a Transaction Request (created using the endpoint
                    [Broadcast Transaction from
                    Wallet](https://docs.dfns.co/api-reference/wallets/sign-and-broadcast-transaction))

                    * a Signature Request (created using the endpoint [Generate
                    Signature from
                    Wallet](https://docs.dfns.co/api-reference/keys/generate-signature))
                  title: Wallets:Sign
                - type: object
                  properties:
                    name:
                      type: string
                    activityKind:
                      type: string
                      enum:
                        - Wallets:IncomingTransaction
                    rule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - ChainalysisTransactionScreening
                            configuration:
                              type: object
                              properties:
                                alerts:
                                  type: object
                                  properties:
                                    alertLevel:
                                      type: string
                                      enum:
                                        - LOW
                                        - MEDIUM
                                        - HIGH
                                        - SEVERE
                                    categoryIds:
                                      type: array
                                      items:
                                        type: integer
                                        exclusiveMinimum: 0
                                  required:
                                    - alertLevel
                                    - categoryIds
                                exposures:
                                  type: object
                                  properties:
                                    direct:
                                      type: object
                                      properties:
                                        categoryIds:
                                          type: array
                                          items:
                                            type: integer
                                            exclusiveMinimum: 0
                                      required:
                                        - categoryIds
                                  required:
                                    - direct
                                userIdTemplate:
                                  type: string
                                  minLength: 1
                                  maxLength: 50
                                  pattern: >-
                                    ^([a-zA-Z0-9_:-]|{wallet\.id}|{wallet\.externalId})+$
                                  default: dfns
                                  description: >-
                                    **Deprecated** — set `userIdTemplate` on the
                                    Chainalysis integration setting instead;
                                    when set there, the integration-level
                                    template takes precedence over this one.


                                    Value sent to Chainalysis as the "user ID".
                                    Used by Chainalysis for grouping transaction
                                    screenings.
                                      
                                    This template can include variables,
                                    included in brackets. The following
                                    variables are currently supported: 
                                    `{wallet.id}` and `{wallet.externalId}`.

                                    As an example, if you set `userIdTemplate:
                                    "dfns:{wallet.id}_{wallet.externalId}"`,
                                    when your wallet receives a transaction that
                                    gets screened by a Chainalysis policy, the
                                    "user ID" sent to Chainalysis will be
                                    `dfns:wa-xxx_yyy` (`wa-xxx` being the wallet
                                    ID, and `yyy` being the wallet external ID).
                                fallbackBehaviours:
                                  type: object
                                  properties:
                                    skipUnscreenableTransaction:
                                      type: boolean
                                    skipUnsupportedNetwork:
                                      type: boolean
                                    skipUnsupportedAsset:
                                      type: boolean
                                    skipChainalysisFailure:
                                      type: boolean
                                  required:
                                    - skipUnscreenableTransaction
                                    - skipUnsupportedNetwork
                                    - skipUnsupportedAsset
                                    - skipChainalysisFailure
                              required:
                                - alerts
                                - exposures
                                - fallbackBehaviours
                              additionalProperties: false
                          required:
                            - kind
                            - configuration
                          additionalProperties: false
                          description: >

                            <Info>

                            This rule can only be used once the Chainalysis
                            integration is activated from the Dfns dashboard
                            settings. (see more on
                            [Chainalysis](https://docs.dfns.co/integrations/aml-kyt/chainalysis)
                            integration page).

                            </Info>


                            This rule can be used on a policy of `activityKind`
                            = `Wallets:IncomingTransaction`, and with the action
                            kind `NoAction`. It's a rule based on Chainalysis
                            KYT integration (Know-Your-Transaction). Upon an
                            incoming transaction detectedby our indexers, we
                            will [register the transfer with
                            Chainalysis](https://docs.chainalysis.com/api/kyt/#registration-register-a-transfer),
                            and fetch the results of the analysis (alerts &
                            exposures detected). Based on the results, and the
                            configuration of this rule, the policy will be
                            triggered.


                            The shape of the rule is almost like the
                            `ChainalysisTransactionPrescreening` rule, expect
                            the the `address` property is not supported.


                            ```json

                            {
                              "rule": {
                                "kind": "ChainalysisTransactionPrescreening",
                                "configuration": {
                                  "alerts": {
                                    "alertLevel": "LOW",
                                    "categoryIds": []
                                  },
                                  "exposures": {
                                    "direct": {
                                      "categoryIds": []
                                    }
                                  },
                                  "fallbackBehaviours": {
                                    "skipUnscreenableTransaction": false,
                                    "skipUnsupportedNetwork": false,
                                    "skipUnsupportedAsset": false,
                                    "skipChainalysisFailure": false
                                  }
                                }
                              }
                            }

                            ```


                            **Configuration**


                            Please refer to the configuration for the
                            `ChainalysisTransactionPrescreening` rule.
                          title: ChainalysisTransactionScreening
                    action:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - NoAction
                          required:
                            - kind
                          additionalProperties: false
                          description: |2-

                                This action kind means that nothing will happen after policy rule evaluation. It's meant to be used with policy rules "`ChainalysisTransactionPrescreening`" or "`ChainalysisTransactionScreening`". This action is for when you just want the KYT analysis rule to be run, and then if triggered, those result returned in a `policy.triggered` [Webhook Event](https://docs.dfns.co/api-reference/webhook-events).

                            ```json
                            {
                              "action": {
                                "kind": "NoAction"
                              }
                            }
                            ```
                                
                          title: NoAction
                    filters:
                      type: object
                      properties:
                        walletId:
                          type: object
                          properties:
                            in:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          required:
                            - in
                          additionalProperties: false
                        walletTags:
                          type: object
                          properties:
                            hasAny:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                            hasAll:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          additionalProperties: false
                      additionalProperties: false
                  required:
                    - name
                    - activityKind
                    - rule
                    - action
                  additionalProperties: false
                  description: >-
                    A "`Wallets:IncomingTransaction`" activity represents when
                    our indexers detected an incoming transaction into a wallet.
                    This activity kind has to be used with a KYT screening rule
                    kind ("`ChainalysisTransactionScreening`" — see more on
                    [Chainalysis](https://docs.dfns.co/integrations/aml-kyt/chainalysis)
                    integration page), and the action kind "`NoAction`", meaning
                    that no actual action will be taken as a result of the
                    screening, other than notifying you through a webhook event
                    if the policy is triggered. The reason for that, is that the
                    incoming transaction is already on-chain, so the funds are
                    already in the wallet, we cannot block that transfer on
                    chain.
                  title: Wallets:IncomingTransaction
                - type: object
                  properties:
                    name:
                      type: string
                    activityKind:
                      type: string
                      enum:
                        - Vaults:ReleaseQuarantine
                    rule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - AlwaysTrigger
                            configuration:
                              type: object
                              properties: {}
                              additionalProperties: false
                          required:
                            - kind
                          additionalProperties: false
                          description: >-
                            This rule will always be triggered, meaning that if
                            this rule is defined on a policy, the policy will
                            always trigger the policy action, regardless of the
                            activity details.
                          title: AlwaysTrigger
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - ChainalysisQuarantineScreening
                            configuration:
                              type: object
                              properties:
                                alerts:
                                  type: object
                                  properties:
                                    alertLevel:
                                      type: string
                                      enum:
                                        - LOW
                                        - MEDIUM
                                        - HIGH
                                        - SEVERE
                                    categoryIds:
                                      type: array
                                      items:
                                        type: integer
                                        exclusiveMinimum: 0
                                  required:
                                    - alertLevel
                                    - categoryIds
                                exposures:
                                  type: object
                                  properties:
                                    direct:
                                      type: object
                                      properties:
                                        categoryIds:
                                          type: array
                                          items:
                                            type: integer
                                            exclusiveMinimum: 0
                                      required:
                                        - categoryIds
                                  required:
                                    - direct
                              required:
                                - alerts
                                - exposures
                              additionalProperties: false
                          required:
                            - kind
                            - configuration
                          additionalProperties: false
                          description: >

                            <Info>

                            This rule can only be used once the Chainalysis
                            integration is activated from the Dfns dashboard
                            settings. (see more on
                            [Chainalysis](https://docs.dfns.co/integrations/aml-kyt/chainalysis)
                            integration page).

                            </Info>


                            This rule can be used on a policy of `activityKind`
                            = `Vaults:ReleaseQuarantine`. When a quarantined
                            vault deposit was screened by Chainalysis KYT, the
                            screening result (alerts & direct exposure) is
                            stored with the quarantine. When a release of the
                            quarantined funds is requested, this rule evaluates
                            that **stored** result — no new Chainalysis call is
                            made. Based on the stored result and the
                            configuration of this rule, the policy will be
                            triggered.


                            If the quarantine has **no stored KYT result** (the
                            result was not received yet, the network/asset is
                            not supported by the Chainalysis integration, or
                            screening failed), the rule **always triggers**
                            (fail closed): the release then follows the policy
                            action (approval or block).


                            ```json

                            {
                              "rule": {
                                "kind": "ChainalysisQuarantineScreening",
                                "configuration": {
                                  "alerts": {
                                    "alertLevel": "LOW",
                                    "categoryIds": []
                                  },
                                  "exposures": {
                                    "direct": {
                                      "categoryIds": []
                                    }
                                  }
                                }
                              }
                            }

                            ```


                            **Configuration**


                            | Property | Type | Description |

                            | --- | --- | --- |

                            | `alerts`<br><br>`.alertLevel`* | `string` |
                            Minimum alert level above which the rule should
                            trigger, if any alert was returned in the stored
                            Chainalysis results. Can be `LOW`, `MEDIUM`, `HIGH`,
                            or `SEVERE` |

                            | `alerts`<br><br>`.categoryIds`* | list of integers
                            | List of Chainalysis category IDs (see
                            [here](https://docs.chainalysis.com/api/kyt/#categories)).
                            If you leave this list empty, alerts of any category
                            will trigger the rule. Otherwise, if you only want
                            the rule to trigger on specific categories, you can
                            specify some in the list. |

                            |
                            `exposures`<br><br>`.direct`<br><br>`.categoryIds`*
                            | list of integers | List of Chainalysis category
                            IDs (see
                            [here](https://docs.chainalysis.com/api/kyt/#categories)).
                            If you leave this list empty, a direct exposure of
                            any category in the stored results will trigger the
                            rule. Otherwise, if you only want the rule to
                            trigger on specific categories, you can specify some
                            in the list. |
                          title: ChainalysisQuarantineScreening
                    action:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - RequestApproval
                            approvalGroups:
                              type: array
                              items:
                                type: object
                                properties:
                                  name:
                                    type: string
                                  quorum:
                                    type: integer
                                    minimum: 1
                                  approvers:
                                    type: object
                                    properties:
                                      userId:
                                        type: object
                                        properties:
                                          in:
                                            type: array
                                            items:
                                              type: string
                                              minLength: 1
                                            minItems: 1
                                            maxItems: 100
                                        required:
                                          - in
                                        additionalProperties: false
                                    additionalProperties: false
                                  initiatorCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether the initiator of the activity can
                                      participate in the approval.
                                  serviceAccountsCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether service accounts can participate
                                      in the approval for this group.
                                required:
                                  - quorum
                                  - approvers
                                additionalProperties: false
                              minItems: 1
                            autoRejectTimeout:
                              type:
                                - integer
                                - 'null'
                              minimum: 1
                          required:
                            - kind
                            - approvalGroups
                          additionalProperties: false
                          description: >-

                            This action means that activity will first require
                            an Approval process to be completed before it can 
                            be executed (or be aborted if someone rejects it
                            during the approval process).


                            One or several groups of approvers need to be
                            specified. These groups define who is allowed to
                            approve / reject an activity.


                            The activity will only be executed if all approver
                            groups reach their "quorum" of approvals. Otherwise,
                            if any one user within any approver group rejects,
                            then the activity is aborted and the call is not
                            executed.


                            The example below shows a `RequestApproval` action,
                            configured with one approval group requiring 2
                            approvals amongst three specific users.


                            ```json

                            {
                              "action": {
                                "kind": "RequestApproval",
                                "autoRejectTimeout": 60, // minutes
                                "approvalGroups": [
                                  {
                                    "name": "Admins",
                                    "quorum": 2, // only 2 approvers required in that group 
                                    "approvers": {
                                      "userId": {
                                        "in": ["us-...1", "us-...2", "us-...3"],
                                      }
                                    }
                                  }
                                ],

                              }
                            }

                            ```


                            **Don't lock yourself up**


                            By default, users cannot approve an activity they
                            initiated themselves, even if they are in an
                            approval group. To allow this, you must set
                            `initiatorCanApprove: true`.


                            *Example 1:* For any wallet transfer, a policy is
                            setup to require approval from **1 specific admin
                            user** (eg. the CEO). `initiatorCanApprove` was not
                            set to `true`. If the CEO himself initiates a
                            transfer, no-one can approve his transfer and it's
                            stuck.


                            *Example 2:* Company has only 3 users. A policy is
                            setup to require approval from **any 3 users**
                            (`quorum: 3`) for any modification of a policy.
                            `initiatorCanApprove` was not set to `true`. In this
                            case, they are locked, and the policy cannot be
                            modified: whoever requests a modification cannot
                            approve, and the policy is therefore always missing
                            one approver. To unlock, they would need to invite a
                            new user and give him the rights to approve as well.
                                
                          title: RequestApproval
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Block
                          required:
                            - kind
                          additionalProperties: false
                          description: >
                            This action means that the activity will be blocked
                            if the policy is triggered.


                            ```json

                            {
                              "action": {
                                "kind": "Block"
                              }
                            }

                            ```
                          title: Block
                    filters:
                      type: object
                      properties:
                        vaultId:
                          type: object
                          properties:
                            in:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          required:
                            - in
                          additionalProperties: false
                        vaultTags:
                          type: object
                          properties:
                            hasAny:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                            hasAll:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          additionalProperties: false
                      additionalProperties: false
                  required:
                    - name
                    - activityKind
                    - rule
                    - action
                  additionalProperties: false
                  description: >-
                    A "`Vaults:ReleaseQuarantine`" activity represents a request
                    to release quarantined vault funds into the available
                    balance. With the action kind "`RequestApproval`", the funds
                    stay quarantined until the configured quorum of approvers
                    approves the release; the release then executes
                    automatically. With the action kind "`Block`", releasing
                    quarantined funds is not allowed.
                  title: Vaults:ReleaseQuarantine
                - type: object
                  properties:
                    name:
                      type: string
                    activityKind:
                      type: string
                      enum:
                        - Vaults:CreateLock
                    rule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - AlwaysTrigger
                            configuration:
                              type: object
                              properties: {}
                              additionalProperties: false
                          required:
                            - kind
                          additionalProperties: false
                          description: >-
                            This rule will always be triggered, meaning that if
                            this rule is defined on a policy, the policy will
                            always trigger the policy action, regardless of the
                            activity details.
                          title: AlwaysTrigger
                    action:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - RequestApproval
                            approvalGroups:
                              type: array
                              items:
                                type: object
                                properties:
                                  name:
                                    type: string
                                  quorum:
                                    type: integer
                                    minimum: 1
                                  approvers:
                                    type: object
                                    properties:
                                      userId:
                                        type: object
                                        properties:
                                          in:
                                            type: array
                                            items:
                                              type: string
                                              minLength: 1
                                            minItems: 1
                                            maxItems: 100
                                        required:
                                          - in
                                        additionalProperties: false
                                    additionalProperties: false
                                  initiatorCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether the initiator of the activity can
                                      participate in the approval.
                                  serviceAccountsCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether service accounts can participate
                                      in the approval for this group.
                                required:
                                  - quorum
                                  - approvers
                                additionalProperties: false
                              minItems: 1
                            autoRejectTimeout:
                              type:
                                - integer
                                - 'null'
                              minimum: 1
                          required:
                            - kind
                            - approvalGroups
                          additionalProperties: false
                          description: >-

                            This action means that activity will first require
                            an Approval process to be completed before it can 
                            be executed (or be aborted if someone rejects it
                            during the approval process).


                            One or several groups of approvers need to be
                            specified. These groups define who is allowed to
                            approve / reject an activity.


                            The activity will only be executed if all approver
                            groups reach their "quorum" of approvals. Otherwise,
                            if any one user within any approver group rejects,
                            then the activity is aborted and the call is not
                            executed.


                            The example below shows a `RequestApproval` action,
                            configured with one approval group requiring 2
                            approvals amongst three specific users.


                            ```json

                            {
                              "action": {
                                "kind": "RequestApproval",
                                "autoRejectTimeout": 60, // minutes
                                "approvalGroups": [
                                  {
                                    "name": "Admins",
                                    "quorum": 2, // only 2 approvers required in that group 
                                    "approvers": {
                                      "userId": {
                                        "in": ["us-...1", "us-...2", "us-...3"],
                                      }
                                    }
                                  }
                                ],

                              }
                            }

                            ```


                            **Don't lock yourself up**


                            By default, users cannot approve an activity they
                            initiated themselves, even if they are in an
                            approval group. To allow this, you must set
                            `initiatorCanApprove: true`.


                            *Example 1:* For any wallet transfer, a policy is
                            setup to require approval from **1 specific admin
                            user** (eg. the CEO). `initiatorCanApprove` was not
                            set to `true`. If the CEO himself initiates a
                            transfer, no-one can approve his transfer and it's
                            stuck.


                            *Example 2:* Company has only 3 users. A policy is
                            setup to require approval from **any 3 users**
                            (`quorum: 3`) for any modification of a policy.
                            `initiatorCanApprove` was not set to `true`. In this
                            case, they are locked, and the policy cannot be
                            modified: whoever requests a modification cannot
                            approve, and the policy is therefore always missing
                            one approver. To unlock, they would need to invite a
                            new user and give him the rights to approve as well.
                                
                          title: RequestApproval
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Block
                          required:
                            - kind
                          additionalProperties: false
                          description: >
                            This action means that the activity will be blocked
                            if the policy is triggered.


                            ```json

                            {
                              "action": {
                                "kind": "Block"
                              }
                            }

                            ```
                          title: Block
                    filters:
                      type: object
                      properties:
                        vaultId:
                          type: object
                          properties:
                            in:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          required:
                            - in
                          additionalProperties: false
                        vaultTags:
                          type: object
                          properties:
                            hasAny:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                            hasAll:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          additionalProperties: false
                      additionalProperties: false
                  required:
                    - name
                    - activityKind
                    - rule
                    - action
                  additionalProperties: false
                  description: >-
                    A "`Vaults:CreateLock`" activity represents a request to
                    lock vault funds. With the action kind "`RequestApproval`",
                    the lock is not created until the configured quorum of
                    approvers approves the request; the lock is then created
                    automatically. With the action kind "`Block`", locking vault
                    funds is not allowed.
                  title: Vaults:CreateLock
                - type: object
                  properties:
                    name:
                      type: string
                    activityKind:
                      type: string
                      enum:
                        - Vaults:ReplaceLock
                    rule:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - AlwaysTrigger
                            configuration:
                              type: object
                              properties: {}
                              additionalProperties: false
                          required:
                            - kind
                          additionalProperties: false
                          description: >-
                            This rule will always be triggered, meaning that if
                            this rule is defined on a policy, the policy will
                            always trigger the policy action, regardless of the
                            activity details.
                          title: AlwaysTrigger
                    action:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - RequestApproval
                            approvalGroups:
                              type: array
                              items:
                                type: object
                                properties:
                                  name:
                                    type: string
                                  quorum:
                                    type: integer
                                    minimum: 1
                                  approvers:
                                    type: object
                                    properties:
                                      userId:
                                        type: object
                                        properties:
                                          in:
                                            type: array
                                            items:
                                              type: string
                                              minLength: 1
                                            minItems: 1
                                            maxItems: 100
                                        required:
                                          - in
                                        additionalProperties: false
                                    additionalProperties: false
                                  initiatorCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether the initiator of the activity can
                                      participate in the approval.
                                  serviceAccountsCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether service accounts can participate
                                      in the approval for this group.
                                required:
                                  - quorum
                                  - approvers
                                additionalProperties: false
                              minItems: 1
                            autoRejectTimeout:
                              type:
                                - integer
                                - 'null'
                              minimum: 1
                          required:
                            - kind
                            - approvalGroups
                          additionalProperties: false
                          description: >-

                            This action means that activity will first require
                            an Approval process to be completed before it can 
                            be executed (or be aborted if someone rejects it
                            during the approval process).


                            One or several groups of approvers need to be
                            specified. These groups define who is allowed to
                            approve / reject an activity.


                            The activity will only be executed if all approver
                            groups reach their "quorum" of approvals. Otherwise,
                            if any one user within any approver group rejects,
                            then the activity is aborted and the call is not
                            executed.


                            The example below shows a `RequestApproval` action,
                            configured with one approval group requiring 2
                            approvals amongst three specific users.


                            ```json

                            {
                              "action": {
                                "kind": "RequestApproval",
                                "autoRejectTimeout": 60, // minutes
                                "approvalGroups": [
                                  {
                                    "name": "Admins",
                                    "quorum": 2, // only 2 approvers required in that group 
                                    "approvers": {
                                      "userId": {
                                        "in": ["us-...1", "us-...2", "us-...3"],
                                      }
                                    }
                                  }
                                ],

                              }
                            }

                            ```


                            **Don't lock yourself up**


                            By default, users cannot approve an activity they
                            initiated themselves, even if they are in an
                            approval group. To allow this, you must set
                            `initiatorCanApprove: true`.


                            *Example 1:* For any wallet transfer, a policy is
                            setup to require approval from **1 specific admin
                            user** (eg. the CEO). `initiatorCanApprove` was not
                            set to `true`. If the CEO himself initiates a
                            transfer, no-one can approve his transfer and it's
                            stuck.


                            *Example 2:* Company has only 3 users. A policy is
                            setup to require approval from **any 3 users**
                            (`quorum: 3`) for any modification of a policy.
                            `initiatorCanApprove` was not set to `true`. In this
                            case, they are locked, and the policy cannot be
                            modified: whoever requests a modification cannot
                            approve, and the policy is therefore always missing
                            one approver. To unlock, they would need to invite a
                            new user and give him the rights to approve as well.
                                
                          title: RequestApproval
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Block
                          required:
                            - kind
                          additionalProperties: false
                          description: >
                            This action means that the activity will be blocked
                            if the policy is triggered.


                            ```json

                            {
                              "action": {
                                "kind": "Block"
                              }
                            }

                            ```
                          title: Block
                    filters:
                      type: object
                      properties:
                        vaultId:
                          type: object
                          properties:
                            in:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          required:
                            - in
                          additionalProperties: false
                        vaultTags:
                          type: object
                          properties:
                            hasAny:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                            hasAll:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              minItems: 1
                              maxItems: 100
                          additionalProperties: false
                      additionalProperties: false
                  required:
                    - name
                    - activityKind
                    - rule
                    - action
                  additionalProperties: false
                  description: >-
                    A "`Vaults:ReplaceLock`" activity represents a request to
                    change the amount of a vault lock. With the action kind
                    "`RequestApproval`", the lock is not replaced until the
                    configured quorum of approvers approves the request; the
                    lock is then automatically released and recreated at the new
                    amount. With the action kind "`Block`", updating vault lock
                    amounts is not allowed.
                  title: Vaults:ReplaceLock
                - type: object
                  properties:
                    name:
                      type: string
                    activityKind:
                      type: string
                      enum:
                        - UserAction
                    rule:
                      type: object
                      properties:
                        kind:
                          type: string
                          enum:
                            - UserAction
                        configuration:
                          type: object
                          properties:
                            userActionKinds:
                              type: array
                              items:
                                type: string
                          required:
                            - userActionKinds
                          additionalProperties: false
                      required:
                        - kind
                        - configuration
                      additionalProperties: false
                      title: UserAction
                    action:
                      oneOf:
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - RequestApproval
                            approvalGroups:
                              type: array
                              items:
                                type: object
                                properties:
                                  name:
                                    type: string
                                  quorum:
                                    type: integer
                                    minimum: 1
                                  approvers:
                                    type: object
                                    properties:
                                      userId:
                                        type: object
                                        properties:
                                          in:
                                            type: array
                                            items:
                                              type: string
                                              minLength: 1
                                            minItems: 1
                                            maxItems: 100
                                        required:
                                          - in
                                        additionalProperties: false
                                    additionalProperties: false
                                  initiatorCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether the initiator of the activity can
                                      participate in the approval.
                                  serviceAccountsCanApprove:
                                    type: boolean
                                    description: >-
                                      Whether service accounts can participate
                                      in the approval for this group.
                                required:
                                  - quorum
                                  - approvers
                                additionalProperties: false
                              minItems: 1
                            autoRejectTimeout:
                              type:
                                - integer
                                - 'null'
                              minimum: 1
                          required:
                            - kind
                            - approvalGroups
                          additionalProperties: false
                          description: >-

                            This action means that activity will first require
                            an Approval process to be completed before it can 
                            be executed (or be aborted if someone rejects it
                            during the approval process).


                            One or several groups of approvers need to be
                            specified. These groups define who is allowed to
                            approve / reject an activity.


                            The activity will only be executed if all approver
                            groups reach their "quorum" of approvals. Otherwise,
                            if any one user within any approver group rejects,
                            then the activity is aborted and the call is not
                            executed.


                            The example below shows a `RequestApproval` action,
                            configured with one approval group requiring 2
                            approvals amongst three specific users.


                            ```json

                            {
                              "action": {
                                "kind": "RequestApproval",
                                "autoRejectTimeout": 60, // minutes
                                "approvalGroups": [
                                  {
                                    "name": "Admins",
                                    "quorum": 2, // only 2 approvers required in that group 
                                    "approvers": {
                                      "userId": {
                                        "in": ["us-...1", "us-...2", "us-...3"],
                                      }
                                    }
                                  }
                                ],

                              }
                            }

                            ```


                            **Don't lock yourself up**


                            By default, users cannot approve an activity they
                            initiated themselves, even if they are in an
                            approval group. To allow this, you must set
                            `initiatorCanApprove: true`.


                            *Example 1:* For any wallet transfer, a policy is
                            setup to require approval from **1 specific admin
                            user** (eg. the CEO). `initiatorCanApprove` was not
                            set to `true`. If the CEO himself initiates a
                            transfer, no-one can approve his transfer and it's
                            stuck.


                            *Example 2:* Company has only 3 users. A policy is
                            setup to require approval from **any 3 users**
                            (`quorum: 3`) for any modification of a policy.
                            `initiatorCanApprove` was not set to `true`. In this
                            case, they are locked, and the policy cannot be
                            modified: whoever requests a modification cannot
                            approve, and the policy is therefore always missing
                            one approver. To unlock, they would need to invite a
                            new user and give him the rights to approve as well.
                                
                          title: RequestApproval
                        - type: object
                          properties:
                            kind:
                              type: string
                              enum:
                                - Block
                          required:
                            - kind
                          additionalProperties: false
                          description: >
                            This action means that the activity will be blocked
                            if the policy is triggered.


                            ```json

                            {
                              "action": {
                                "kind": "Block"
                              }
                            }

                            ```
                          title: Block
                    filters:
                      type: object
                      properties: {}
                  required:
                    - name
                    - activityKind
                    - rule
                    - action
                  additionalProperties: false
                  description: ''
                  title: UserAction
            examples:
              Chainalysis Transaction Prescreening:
                value:
                  name: chainalysis prescreening policy
                  activityKind: Wallets:Sign
                  rule:
                    kind: ChainalysisTransactionPrescreening
                    configuration:
                      alerts:
                        alertLevel: LOW
                        categoryIds: []
                      exposures:
                        direct:
                          categoryIds: []
                      addresses:
                        alertLevel: LOW
                        categoryIds: []
                      fallbackBehaviours:
                        skipUnscreenableTransaction: false
                        skipUnsupportedNetwork: false
                        skipUnsupportedAsset: false
                        skipChainalysisFailure: false
                  action:
                    kind: Block
                  filters:
                    walletId:
                      in:
                        - wa-4sql3-a6ct4-8j2q8ih86d853rgg
                        - wa-j9btt-5s9o8-i3r8373ddg0usn3
              Transaction Amount Limit in fiat:
                value:
                  name: transfers worth 25,000 USD or more need approval
                  activityKind: Wallets:Sign
                  rule:
                    kind: TransactionAmountLimit
                    configuration:
                      limit: 25000
                      currency: USD
                  action:
                    kind: RequestApproval
                    autoRejectTimeout: 60
                    approvalGroups:
                      - name: treasury
                        quorum: 2
                        approvers:
                          userId:
                            in:
                              - us-2j5db-4t9ku-9nv7c8pmqk1f3rgb
                              - us-7q1mv-h3d0s-4l8ptn6cyj2wk5fa
                              - us-b4xna-r7wcp-8k3fgm1dtq9sv6ez
              Transaction Amount Limit in the units of each asset:
                value:
                  name: hard cap of 5 ETH and 100,000 USDC per transfer
                  activityKind: Wallets:Sign
                  filters:
                    walletId:
                      in:
                        - wa-4sql3-a6ct4-8j2q8ih86d853rgg
                  rule:
                    kind: TransactionAmountLimitNominal
                    configuration:
                      assets:
                        - network: Ethereum
                          tid: native:eth
                          limit: '5000000000000000000'
                        - network: Ethereum
                          tid: erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
                          limit: '100000000000'
                  action:
                    kind: Block
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Policy'
      security:
        - authenticationToken: []
          userActionSignature: []
components:
  schemas:
    Network:
      type: string
      title: Network
      enum:
        - Algorand
        - AlgorandTestnet
        - Aptos
        - AptosTestnet
        - ArbitrumOne
        - ArbitrumSepolia
        - Arc
        - ArcTestnet
        - Areum
        - AvalancheC
        - AvalancheCFuji
        - Base
        - BaseSepolia
        - Berachain
        - BerachainBepolia
        - Bitcoin
        - BitcoinSignet
        - BitcoinTestnet4
        - BitcoinCash
        - Bob
        - BobSepolia
        - Bsc
        - BscTestnet
        - Canton
        - CantonTestnet
        - Cardano
        - CardanoPreprod
        - Concordium
        - ConcordiumTestnet
        - Celo
        - CeloSepolia
        - Codex
        - CodexSepolia
        - CosmosHub4
        - CosmosIcsTestnet
        - Dogecoin
        - DogecoinTestnet
        - Ethereum
        - EthereumClassic
        - EthereumClassicMordor
        - EthereumSepolia
        - EthereumHoodi
        - FlareC
        - FlareCCoston2
        - FlowEvm
        - FlowEvmTestnet
        - Hedera
        - HederaTestnet
        - Ink
        - InkSepolia
        - InternetComputer
        - Ion
        - IonTestnet
        - Iota
        - IotaTestnet
        - Kusama
        - KusamaAssetHub
        - Litecoin
        - LitecoinTestnet
        - Movement
        - MovementTestnet
        - Near
        - NearTestnet
        - Optimism
        - OptimismSepolia
        - Origyn
        - Plasma
        - PlasmaTestnet
        - Plume
        - PlumeSepolia
        - Paseo
        - PaseoAssetHub
        - Polkadot
        - PolkadotAssetHub
        - Polygon
        - PolygonAmoy
        - Polymesh
        - PolymeshTestnet
        - Rayls
        - RaylsTestnet
        - Robinhood
        - RobinhoodSepolia
        - SeiAtlantic2
        - SeiPacific1
        - Solana
        - SolanaDevnet
        - Sonic
        - SonicTestnet
        - Starknet
        - StarknetSepolia
        - Stellar
        - StellarTestnet
        - Sui
        - SuiTestnet
        - Tezos
        - TezosShadownet
        - Tempo
        - TempoModerato
        - Tsc
        - TscTestnet1
        - Ton
        - TonTestnet
        - Tron
        - TronNile
        - Westend
        - WestendAssetHub
        - Xdc
        - XdcApothem
        - XLayer
        - XLayerSepolia
        - XrpLedger
        - XrpLedgerTestnet
    Policy:
      oneOf:
        - type: object
          properties:
            id:
              type: string
            name:
              type: string
            status:
              type: string
              enum:
                - Active
                - Archived
            dateCreated:
              type: string
            dateUpdated:
              type: string
            activityKind:
              type: string
              enum:
                - Registry:Addresses:Modify
            rule:
              type: object
              properties:
                kind:
                  type: string
                  enum:
                    - AlwaysTrigger
                configuration:
                  type: object
                  properties: {}
                  additionalProperties: false
              required:
                - kind
              additionalProperties: false
              description: >-
                This rule will always be triggered, meaning that if this rule is
                defined on a policy, the policy will always trigger the policy
                action, regardless of the activity details.
              title: AlwaysTrigger
            action:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - RequestApproval
                    approvalGroups:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                          quorum:
                            type: integer
                            minimum: 1
                          approvers:
                            type: object
                            properties:
                              userId:
                                type: object
                                properties:
                                  in:
                                    type: array
                                    items:
                                      type: string
                                      minLength: 1
                                    minItems: 1
                                    maxItems: 100
                                required:
                                  - in
                                additionalProperties: false
                            additionalProperties: false
                          initiatorCanApprove:
                            type: boolean
                            description: >-
                              Whether the initiator of the activity can
                              participate in the approval.
                          serviceAccountsCanApprove:
                            type: boolean
                            description: >-
                              Whether service accounts can participate in the
                              approval for this group.
                        required:
                          - quorum
                          - approvers
                        additionalProperties: false
                      minItems: 1
                    autoRejectTimeout:
                      type:
                        - integer
                        - 'null'
                      minimum: 1
                  required:
                    - kind
                    - approvalGroups
                  additionalProperties: false
                  description: >-

                    This action means that activity will first require an
                    Approval process to be completed before it can  be executed
                    (or be aborted if someone rejects it during the approval
                    process).


                    One or several groups of approvers need to be specified.
                    These groups define who is allowed to approve / reject an
                    activity.


                    The activity will only be executed if all approver groups
                    reach their "quorum" of approvals. Otherwise, if any one
                    user within any approver group rejects, then the activity is
                    aborted and the call is not executed.


                    The example below shows a `RequestApproval` action,
                    configured with one approval group requiring 2 approvals
                    amongst three specific users.


                    ```json

                    {
                      "action": {
                        "kind": "RequestApproval",
                        "autoRejectTimeout": 60, // minutes
                        "approvalGroups": [
                          {
                            "name": "Admins",
                            "quorum": 2, // only 2 approvers required in that group 
                            "approvers": {
                              "userId": {
                                "in": ["us-...1", "us-...2", "us-...3"],
                              }
                            }
                          }
                        ],

                      }
                    }

                    ```


                    **Don't lock yourself up**


                    By default, users cannot approve an activity they initiated
                    themselves, even if they are in an approval group. To allow
                    this, you must set `initiatorCanApprove: true`.


                    *Example 1:* For any wallet transfer, a policy is setup to
                    require approval from **1 specific admin user** (eg. the
                    CEO). `initiatorCanApprove` was not set to `true`. If the
                    CEO himself initiates a transfer, no-one can approve his
                    transfer and it's stuck.


                    *Example 2:* Company has only 3 users. A policy is setup to
                    require approval from **any 3 users** (`quorum: 3`) for any
                    modification of a policy. `initiatorCanApprove` was not set
                    to `true`. In this case, they are locked, and the policy
                    cannot be modified: whoever requests a modification cannot
                    approve, and the policy is therefore always missing one
                    approver. To unlock, they would need to invite a new user
                    and give him the rights to approve as well.
                        
                  title: RequestApproval
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Block
                  required:
                    - kind
                  additionalProperties: false
                  description: >
                    This action means that the activity will be blocked if the
                    policy is triggered.


                    ```json

                    {
                      "action": {
                        "kind": "Block"
                      }
                    }

                    ```
                  title: Block
            filters:
              type: object
              properties: {}
          required:
            - id
            - name
            - status
            - activityKind
            - rule
            - action
          additionalProperties: false
          title: Registry:Addresses:Modify
        - type: object
          properties:
            id:
              type: string
            name:
              type: string
            status:
              type: string
              enum:
                - Active
                - Archived
            dateCreated:
              type: string
            dateUpdated:
              type: string
            activityKind:
              type: string
              enum:
                - Permissions:Assign
            rule:
              type: object
              properties:
                kind:
                  type: string
                  enum:
                    - AlwaysTrigger
                configuration:
                  type: object
                  properties: {}
                  additionalProperties: false
              required:
                - kind
              additionalProperties: false
              description: >-
                This rule will always be triggered, meaning that if this rule is
                defined on a policy, the policy will always trigger the policy
                action, regardless of the activity details.
              title: AlwaysTrigger
            action:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - RequestApproval
                    approvalGroups:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                          quorum:
                            type: integer
                            minimum: 1
                          approvers:
                            type: object
                            properties:
                              userId:
                                type: object
                                properties:
                                  in:
                                    type: array
                                    items:
                                      type: string
                                      minLength: 1
                                    minItems: 1
                                    maxItems: 100
                                required:
                                  - in
                                additionalProperties: false
                            additionalProperties: false
                          initiatorCanApprove:
                            type: boolean
                            description: >-
                              Whether the initiator of the activity can
                              participate in the approval.
                          serviceAccountsCanApprove:
                            type: boolean
                            description: >-
                              Whether service accounts can participate in the
                              approval for this group.
                        required:
                          - quorum
                          - approvers
                        additionalProperties: false
                      minItems: 1
                    autoRejectTimeout:
                      type:
                        - integer
                        - 'null'
                      minimum: 1
                  required:
                    - kind
                    - approvalGroups
                  additionalProperties: false
                  description: >-

                    This action means that activity will first require an
                    Approval process to be completed before it can  be executed
                    (or be aborted if someone rejects it during the approval
                    process).


                    One or several groups of approvers need to be specified.
                    These groups define who is allowed to approve / reject an
                    activity.


                    The activity will only be executed if all approver groups
                    reach their "quorum" of approvals. Otherwise, if any one
                    user within any approver group rejects, then the activity is
                    aborted and the call is not executed.


                    The example below shows a `RequestApproval` action,
                    configured with one approval group requiring 2 approvals
                    amongst three specific users.


                    ```json

                    {
                      "action": {
                        "kind": "RequestApproval",
                        "autoRejectTimeout": 60, // minutes
                        "approvalGroups": [
                          {
                            "name": "Admins",
                            "quorum": 2, // only 2 approvers required in that group 
                            "approvers": {
                              "userId": {
                                "in": ["us-...1", "us-...2", "us-...3"],
                              }
                            }
                          }
                        ],

                      }
                    }

                    ```


                    **Don't lock yourself up**


                    By default, users cannot approve an activity they initiated
                    themselves, even if they are in an approval group. To allow
                    this, you must set `initiatorCanApprove: true`.


                    *Example 1:* For any wallet transfer, a policy is setup to
                    require approval from **1 specific admin user** (eg. the
                    CEO). `initiatorCanApprove` was not set to `true`. If the
                    CEO himself initiates a transfer, no-one can approve his
                    transfer and it's stuck.


                    *Example 2:* Company has only 3 users. A policy is setup to
                    require approval from **any 3 users** (`quorum: 3`) for any
                    modification of a policy. `initiatorCanApprove` was not set
                    to `true`. In this case, they are locked, and the policy
                    cannot be modified: whoever requests a modification cannot
                    approve, and the policy is therefore always missing one
                    approver. To unlock, they would need to invite a new user
                    and give him the rights to approve as well.
                        
                  title: RequestApproval
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Block
                  required:
                    - kind
                  additionalProperties: false
                  description: >
                    This action means that the activity will be blocked if the
                    policy is triggered.


                    ```json

                    {
                      "action": {
                        "kind": "Block"
                      }
                    }

                    ```
                  title: Block
            filters:
              type: object
              properties:
                permissionId:
                  type: object
                  properties:
                    in:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  required:
                    - in
                  additionalProperties: false
              required:
                - permissionId
              additionalProperties: false
          required:
            - id
            - name
            - status
            - activityKind
            - rule
            - action
          additionalProperties: false
          title: Permissions:Assign
        - type: object
          properties:
            id:
              type: string
            name:
              type: string
            status:
              type: string
              enum:
                - Active
                - Archived
            dateCreated:
              type: string
            dateUpdated:
              type: string
            activityKind:
              type: string
              enum:
                - Permissions:Modify
            rule:
              type: object
              properties:
                kind:
                  type: string
                  enum:
                    - AlwaysTrigger
                configuration:
                  type: object
                  properties: {}
                  additionalProperties: false
              required:
                - kind
              additionalProperties: false
              description: >-
                This rule will always be triggered, meaning that if this rule is
                defined on a policy, the policy will always trigger the policy
                action, regardless of the activity details.
              title: AlwaysTrigger
            action:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - RequestApproval
                    approvalGroups:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                          quorum:
                            type: integer
                            minimum: 1
                          approvers:
                            type: object
                            properties:
                              userId:
                                type: object
                                properties:
                                  in:
                                    type: array
                                    items:
                                      type: string
                                      minLength: 1
                                    minItems: 1
                                    maxItems: 100
                                required:
                                  - in
                                additionalProperties: false
                            additionalProperties: false
                          initiatorCanApprove:
                            type: boolean
                            description: >-
                              Whether the initiator of the activity can
                              participate in the approval.
                          serviceAccountsCanApprove:
                            type: boolean
                            description: >-
                              Whether service accounts can participate in the
                              approval for this group.
                        required:
                          - quorum
                          - approvers
                        additionalProperties: false
                      minItems: 1
                    autoRejectTimeout:
                      type:
                        - integer
                        - 'null'
                      minimum: 1
                  required:
                    - kind
                    - approvalGroups
                  additionalProperties: false
                  description: >-

                    This action means that activity will first require an
                    Approval process to be completed before it can  be executed
                    (or be aborted if someone rejects it during the approval
                    process).


                    One or several groups of approvers need to be specified.
                    These groups define who is allowed to approve / reject an
                    activity.


                    The activity will only be executed if all approver groups
                    reach their "quorum" of approvals. Otherwise, if any one
                    user within any approver group rejects, then the activity is
                    aborted and the call is not executed.


                    The example below shows a `RequestApproval` action,
                    configured with one approval group requiring 2 approvals
                    amongst three specific users.


                    ```json

                    {
                      "action": {
                        "kind": "RequestApproval",
                        "autoRejectTimeout": 60, // minutes
                        "approvalGroups": [
                          {
                            "name": "Admins",
                            "quorum": 2, // only 2 approvers required in that group 
                            "approvers": {
                              "userId": {
                                "in": ["us-...1", "us-...2", "us-...3"],
                              }
                            }
                          }
                        ],

                      }
                    }

                    ```


                    **Don't lock yourself up**


                    By default, users cannot approve an activity they initiated
                    themselves, even if they are in an approval group. To allow
                    this, you must set `initiatorCanApprove: true`.


                    *Example 1:* For any wallet transfer, a policy is setup to
                    require approval from **1 specific admin user** (eg. the
                    CEO). `initiatorCanApprove` was not set to `true`. If the
                    CEO himself initiates a transfer, no-one can approve his
                    transfer and it's stuck.


                    *Example 2:* Company has only 3 users. A policy is setup to
                    require approval from **any 3 users** (`quorum: 3`) for any
                    modification of a policy. `initiatorCanApprove` was not set
                    to `true`. In this case, they are locked, and the policy
                    cannot be modified: whoever requests a modification cannot
                    approve, and the policy is therefore always missing one
                    approver. To unlock, they would need to invite a new user
                    and give him the rights to approve as well.
                        
                  title: RequestApproval
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Block
                  required:
                    - kind
                  additionalProperties: false
                  description: >
                    This action means that the activity will be blocked if the
                    policy is triggered.


                    ```json

                    {
                      "action": {
                        "kind": "Block"
                      }
                    }

                    ```
                  title: Block
            filters:
              type: object
              properties:
                permissionId:
                  type: object
                  properties:
                    in:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  required:
                    - in
                  additionalProperties: false
              required:
                - permissionId
              additionalProperties: false
          required:
            - id
            - name
            - status
            - activityKind
            - rule
            - action
          additionalProperties: false
          title: Permissions:Modify
        - type: object
          properties:
            id:
              type: string
            name:
              type: string
            status:
              type: string
              enum:
                - Active
                - Archived
            dateCreated:
              type: string
            dateUpdated:
              type: string
            activityKind:
              type: string
              enum:
                - Policies:Modify
            rule:
              type: object
              properties:
                kind:
                  type: string
                  enum:
                    - AlwaysTrigger
                configuration:
                  type: object
                  properties: {}
                  additionalProperties: false
              required:
                - kind
              additionalProperties: false
              description: >-
                This rule will always be triggered, meaning that if this rule is
                defined on a policy, the policy will always trigger the policy
                action, regardless of the activity details.
              title: AlwaysTrigger
            action:
              type: object
              properties:
                kind:
                  type: string
                  enum:
                    - RequestApproval
                approvalGroups:
                  type: array
                  items:
                    type: object
                    properties:
                      name:
                        type: string
                      quorum:
                        type: integer
                        minimum: 1
                      approvers:
                        type: object
                        properties:
                          userId:
                            type: object
                            properties:
                              in:
                                type: array
                                items:
                                  type: string
                                  minLength: 1
                                minItems: 1
                                maxItems: 100
                            required:
                              - in
                            additionalProperties: false
                        additionalProperties: false
                      initiatorCanApprove:
                        type: boolean
                        description: >-
                          Whether the initiator of the activity can participate
                          in the approval.
                      serviceAccountsCanApprove:
                        type: boolean
                        description: >-
                          Whether service accounts can participate in the
                          approval for this group.
                    required:
                      - quorum
                      - approvers
                    additionalProperties: false
                  minItems: 1
                autoRejectTimeout:
                  type:
                    - integer
                    - 'null'
                  minimum: 1
              required:
                - kind
                - approvalGroups
              additionalProperties: false
              description: >-

                This action means that activity will first require an Approval
                process to be completed before it can  be executed (or be
                aborted if someone rejects it during the approval process).


                One or several groups of approvers need to be specified. These
                groups define who is allowed to approve / reject an activity.


                The activity will only be executed if all approver groups reach
                their "quorum" of approvals. Otherwise, if any one user within
                any approver group rejects, then the activity is aborted and the
                call is not executed.


                The example below shows a `RequestApproval` action, configured
                with one approval group requiring 2 approvals amongst three
                specific users.


                ```json

                {
                  "action": {
                    "kind": "RequestApproval",
                    "autoRejectTimeout": 60, // minutes
                    "approvalGroups": [
                      {
                        "name": "Admins",
                        "quorum": 2, // only 2 approvers required in that group 
                        "approvers": {
                          "userId": {
                            "in": ["us-...1", "us-...2", "us-...3"],
                          }
                        }
                      }
                    ],

                  }
                }

                ```


                **Don't lock yourself up**


                By default, users cannot approve an activity they initiated
                themselves, even if they are in an approval group. To allow
                this, you must set `initiatorCanApprove: true`.


                *Example 1:* For any wallet transfer, a policy is setup to
                require approval from **1 specific admin user** (eg. the CEO).
                `initiatorCanApprove` was not set to `true`. If the CEO himself
                initiates a transfer, no-one can approve his transfer and it's
                stuck.


                *Example 2:* Company has only 3 users. A policy is setup to
                require approval from **any 3 users** (`quorum: 3`) for any
                modification of a policy. `initiatorCanApprove` was not set to
                `true`. In this case, they are locked, and the policy cannot be
                modified: whoever requests a modification cannot approve, and
                the policy is therefore always missing one approver. To unlock,
                they would need to invite a new user and give him the rights to
                approve as well.
                    
              title: RequestApproval
            filters:
              type: object
              properties:
                policyId:
                  type: object
                  properties:
                    in:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  required:
                    - in
                  additionalProperties: false
              required:
                - policyId
              additionalProperties: false
          required:
            - id
            - name
            - status
            - activityKind
            - rule
            - action
          additionalProperties: false
          title: Policies:Modify
        - type: object
          properties:
            id:
              type: string
            name:
              type: string
            status:
              type: string
              enum:
                - Active
                - Archived
            dateCreated:
              type: string
            dateUpdated:
              type: string
            activityKind:
              type: string
              enum:
                - Registry:ContractSchemas:Modify
            rule:
              type: object
              properties:
                kind:
                  type: string
                  enum:
                    - AlwaysTrigger
                configuration:
                  type: object
                  properties: {}
                  additionalProperties: false
              required:
                - kind
              additionalProperties: false
              description: >-
                This rule will always be triggered, meaning that if this rule is
                defined on a policy, the policy will always trigger the policy
                action, regardless of the activity details.
              title: AlwaysTrigger
            action:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - RequestApproval
                    approvalGroups:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                          quorum:
                            type: integer
                            minimum: 1
                          approvers:
                            type: object
                            properties:
                              userId:
                                type: object
                                properties:
                                  in:
                                    type: array
                                    items:
                                      type: string
                                      minLength: 1
                                    minItems: 1
                                    maxItems: 100
                                required:
                                  - in
                                additionalProperties: false
                            additionalProperties: false
                          initiatorCanApprove:
                            type: boolean
                            description: >-
                              Whether the initiator of the activity can
                              participate in the approval.
                          serviceAccountsCanApprove:
                            type: boolean
                            description: >-
                              Whether service accounts can participate in the
                              approval for this group.
                        required:
                          - quorum
                          - approvers
                        additionalProperties: false
                      minItems: 1
                    autoRejectTimeout:
                      type:
                        - integer
                        - 'null'
                      minimum: 1
                  required:
                    - kind
                    - approvalGroups
                  additionalProperties: false
                  description: >-

                    This action means that activity will first require an
                    Approval process to be completed before it can  be executed
                    (or be aborted if someone rejects it during the approval
                    process).


                    One or several groups of approvers need to be specified.
                    These groups define who is allowed to approve / reject an
                    activity.


                    The activity will only be executed if all approver groups
                    reach their "quorum" of approvals. Otherwise, if any one
                    user within any approver group rejects, then the activity is
                    aborted and the call is not executed.


                    The example below shows a `RequestApproval` action,
                    configured with one approval group requiring 2 approvals
                    amongst three specific users.


                    ```json

                    {
                      "action": {
                        "kind": "RequestApproval",
                        "autoRejectTimeout": 60, // minutes
                        "approvalGroups": [
                          {
                            "name": "Admins",
                            "quorum": 2, // only 2 approvers required in that group 
                            "approvers": {
                              "userId": {
                                "in": ["us-...1", "us-...2", "us-...3"],
                              }
                            }
                          }
                        ],

                      }
                    }

                    ```


                    **Don't lock yourself up**


                    By default, users cannot approve an activity they initiated
                    themselves, even if they are in an approval group. To allow
                    this, you must set `initiatorCanApprove: true`.


                    *Example 1:* For any wallet transfer, a policy is setup to
                    require approval from **1 specific admin user** (eg. the
                    CEO). `initiatorCanApprove` was not set to `true`. If the
                    CEO himself initiates a transfer, no-one can approve his
                    transfer and it's stuck.


                    *Example 2:* Company has only 3 users. A policy is setup to
                    require approval from **any 3 users** (`quorum: 3`) for any
                    modification of a policy. `initiatorCanApprove` was not set
                    to `true`. In this case, they are locked, and the policy
                    cannot be modified: whoever requests a modification cannot
                    approve, and the policy is therefore always missing one
                    approver. To unlock, they would need to invite a new user
                    and give him the rights to approve as well.
                        
                  title: RequestApproval
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Block
                  required:
                    - kind
                  additionalProperties: false
                  description: >
                    This action means that the activity will be blocked if the
                    policy is triggered.


                    ```json

                    {
                      "action": {
                        "kind": "Block"
                      }
                    }

                    ```
                  title: Block
            filters:
              type: object
              properties: {}
          required:
            - id
            - name
            - status
            - activityKind
            - rule
            - action
          additionalProperties: false
          title: Registry:ContractSchemas:Modify
        - type: object
          properties:
            id:
              type: string
            name:
              type: string
            status:
              type: string
              enum:
                - Active
                - Archived
            dateCreated:
              type: string
            dateUpdated:
              type: string
            activityKind:
              type: string
              enum:
                - Wallets:Sign
            rule:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - AlwaysTrigger
                    configuration:
                      type: object
                      properties: {}
                      additionalProperties: false
                  required:
                    - kind
                  additionalProperties: false
                  description: >-
                    This rule will always be triggered, meaning that if this
                    rule is defined on a policy, the policy will always trigger
                    the policy action, regardless of the activity details.
                  title: AlwaysTrigger
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - TransactionRecipientWhitelist
                    configuration:
                      type: object
                      properties:
                        addresses:
                          type: array
                          items:
                            type: string
                            minLength: 1
                          description: Whitelisted recipient addresses
                      required:
                        - addresses
                      additionalProperties: false
                  required:
                    - kind
                    - configuration
                  additionalProperties: false
                  description: >-
                    This rule will trigger if the destination address *is NOT
                    whitelisted*.
                  title: TransactionRecipientWhitelist
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - TransactionAmountLimit
                    configuration:
                      type: object
                      properties:
                        limit:
                          type: number
                          description: Amount limit in `currency`
                        currency:
                          type: string
                          enum:
                            - USD
                          description: Fiat currency, currently only `USD`
                      required:
                        - limit
                        - currency
                      additionalProperties: false
                  required:
                    - kind
                    - configuration
                  additionalProperties: false
                  description: >-
                    This rule will trigger if the wallet activity detected is
                    transferring some value which amount is greater than a given
                    limit.


                    The limit is expressed in a fiat `currency` and evaluated
                    against the market value of the transfer. To set a threshold
                    in the asset's own units instead, use
                    `TransactionAmountLimitNominal`.


                    Note: If the amount of the wallet activity cannot be
                    evaluated for any reason (eg. market prices are not
                    available, or eg. the amount cannot be inferred from a
                    wallet signature request, etc.), by default the rule will
                    trigger the policy (this is called "failing closed" and is
                    generally considered a security best practice).
                  title: TransactionAmountLimit
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - TransactionAmountLimitNominal
                    configuration:
                      type: object
                      properties:
                        assets:
                          type: array
                          items:
                            type: object
                            properties:
                              network:
                                allOf:
                                  - $ref: '#/components/schemas/Network'
                                  - description: The network the asset lives on.
                              tid:
                                type: string
                                minLength: 1
                                maxLength: 200
                                pattern: ^[a-z0-9_]+:[^\s](?:[ ]?[^\s])*$
                                description: >-
                                  The Dfns token identifier of the asset, for
                                  example `native:eth` or
                                  `erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`.
                                  Must be canonical: token contract addresses on
                                  hex based networks are lower cased.
                              limit:
                                type: string
                                pattern: ^\d+$
                                description: >-
                                  Amount limit in the minimum denomination of
                                  the asset, as an integer string, matching how
                                  a transfer expresses its amount. For an 18
                                  decimal token `"5000000000000000000"` is 5
                                  whole tokens.
                            required:
                              - network
                              - tid
                              - limit
                            additionalProperties: false
                          minItems: 1
                          maxItems: 100
                          description: >-
                            The assets this rule applies to, each with its own
                            limit. A transfer of an asset that is not listed
                            does not trigger the rule. The limit applies to each
                            matching transfer individually; nothing is
                            accumulated across transfers.
                      required:
                        - assets
                      additionalProperties: false
                  required:
                    - kind
                    - configuration
                  additionalProperties: false
                  description: >-
                    This rule will trigger if the wallet activity detected is
                    transferring more of a listed asset than that asset's limit.


                    Each limit is expressed in the minimum denomination of its
                    own asset and compared against the transferred amount
                    directly, so the verdict needs no market data and does not
                    move with a price. To set a threshold on the fiat value of a
                    transfer instead, use `TransactionAmountLimit`.


                    Limits are asset exact: an asset is identified by its
                    network and its Dfns token identifier, so a wrapped or
                    staked derivative is a different asset from the thing it
                    tracks, and a transfer of an asset the rule does not list
                    will not trigger it.


                    Note: If the transferred amount or the asset cannot be
                    determined for any reason, by default the rule will trigger
                    the policy (this is called "failing closed" and is generally
                    considered a security best practice).
                  title: TransactionAmountLimitNominal
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - TransactionAmountVelocity
                    configuration:
                      type: object
                      properties:
                        limit:
                          type: number
                          description: Amount limit in `currency`
                        currency:
                          type: string
                          enum:
                            - USD
                          description: Currency for the amount limit above
                        timeframe:
                          type: integer
                          minimum: 1
                          maximum: 43200
                          description: Time period in minutes. Minimum 1, Maximum 43,200.
                      required:
                        - limit
                        - currency
                        - timeframe
                      additionalProperties: false
                  required:
                    - kind
                    - configuration
                  additionalProperties: false
                  description: >-
                    This rule will trigger if the cumulative amount transferred
                    from a given wallet within a given timeframe is greater than
                    a specified limit.  The aggregate amount evaluated is based
                    only on the wallet that triggered the policy.
                  title: TransactionAmountVelocity
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - TransactionCountVelocity
                    configuration:
                      type: object
                      properties:
                        limit:
                          type: number
                          description: Count limit
                        timeframe:
                          type: integer
                          minimum: 1
                          maximum: 43200
                          description: Time period in minutes. Minimum 1, Maximum 43,200.
                      required:
                        - limit
                        - timeframe
                      additionalProperties: false
                  required:
                    - kind
                    - configuration
                  additionalProperties: false
                  description: >-
                    This rule will trigger if the number of wallet activities
                    for a given wallet within a given timeframe, is greater than
                    a specified limit. The aggregate number of transactions
                    evaluated is based only on the wallet that triggered the
                    policy.
                  title: TransactionCountVelocity
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - ChainalysisTransactionPrescreening
                    configuration:
                      type: object
                      properties:
                        alerts:
                          type: object
                          properties:
                            alertLevel:
                              type: string
                              enum:
                                - LOW
                                - MEDIUM
                                - HIGH
                                - SEVERE
                            categoryIds:
                              type: array
                              items:
                                type: integer
                                exclusiveMinimum: 0
                          required:
                            - alertLevel
                            - categoryIds
                        exposures:
                          type: object
                          properties:
                            direct:
                              type: object
                              properties:
                                categoryIds:
                                  type: array
                                  items:
                                    type: integer
                                    exclusiveMinimum: 0
                              required:
                                - categoryIds
                          required:
                            - direct
                        addresses:
                          type: object
                          properties:
                            categoryIds:
                              type: array
                              items:
                                type: integer
                                exclusiveMinimum: 0
                          required:
                            - categoryIds
                        userIdTemplate:
                          type: string
                          minLength: 1
                          maxLength: 50
                          pattern: >-
                            ^([a-zA-Z0-9_:-]|{wallet\.id}|{wallet\.externalId})+$
                          default: dfns
                          description: >-
                            **Deprecated** — set `userIdTemplate` on the
                            Chainalysis integration setting instead; when set
                            there, the integration-level template takes
                            precedence over this one.


                            Value sent to Chainalysis as the "user ID". Used by
                            Chainalysis for grouping transaction screenings.
                              
                            This template can include variables, included in
                            brackets. The following variables are currently
                            supported:  `{wallet.id}` and `{wallet.externalId}`.

                            As an example, if you set `userIdTemplate:
                            "dfns:{wallet.id}_{wallet.externalId}"`, when your
                            wallet receives a transaction that gets screened by
                            a Chainalysis policy, the "user ID" sent to
                            Chainalysis will be `dfns:wa-xxx_yyy` (`wa-xxx`
                            being the wallet ID, and `yyy` being the wallet
                            external ID).
                        fallbackBehaviours:
                          type: object
                          properties:
                            skipUnscreenableTransaction:
                              type: boolean
                            skipUnsupportedNetwork:
                              type: boolean
                            skipUnsupportedAsset:
                              type: boolean
                            skipChainalysisFailure:
                              type: boolean
                          required:
                            - skipUnscreenableTransaction
                            - skipUnsupportedNetwork
                            - skipUnsupportedAsset
                            - skipChainalysisFailure
                      required:
                        - alerts
                        - exposures
                        - addresses
                        - fallbackBehaviours
                      additionalProperties: false
                  required:
                    - kind
                    - configuration
                  additionalProperties: false
                  description: >+

                    <Info>

                    This rule can only be used once the Chainalysis integration
                    is activated from the Dfns dashboard settings. (see more on
                    [Chainalysis](https://docs.dfns.co/integrations/aml-kyt/chainalysis)
                    integration page).

                    </Info>


                    It's a rule based on
                    [Chainalysis](https://docs.dfns.co/integrations/aml-kyt/chainalysis)
                    KYT integration (Know-Your-Transaction). Upon transfer
                    attempt, we will first register the transfer with
                    Chainalysis (as a ["withdrawal
                    attempt"](https://docs.chainalysis.com/api/kyt/#registration-register-a-withdrawal-attempt)),
                    and fetch the screening results (alerts, exposures,
                    addresses detected). Based on the results, and the
                    configuration of this rule, the policy will be triggered.


                    It's called "Pre"-screening, because the scanned transaction
                    is not on chain yet, it's still a transaction attempt
                    (before the transaction actually make it on chain).


                    ```json

                    {
                      "rule": {
                        "kind": "ChainalysisTransactionPrescreening",
                        "configuration": {
                          "alerts": {
                            "alertLevel": "LOW",
                            "categoryIds": []
                          },
                          "exposures": {
                            "direct": {
                              "categoryIds": []
                            }
                          },
                          "addresses": {
                            "categoryIds": []
                          },
                          "fallbackBehaviours": {
                            "skipUnscreenableTransaction": false,
                            "skipUnsupportedNetwork": false,
                            "skipUnsupportedAsset": false,
                            "skipChainalysisFailure": false
                          }
                        }
                      }
                    }

                    ```


                    **Configuration**


                    | Property | Type | Description |

                    | --- | --- | --- |

                    | `alerts`<br><br>`.alertLevel`* | `string` | Minimum alert
                    level above which the rule should trigger, if any [alert is
                    returned in Chainalysis
                    results](https://docs.chainalysis.com/api/kyt/#withdrawal-attempts-get-alerts).
                    Can be `LOW`, `MEDIUM`, `HIGH`, or `SEVERE` |

                    | `alerts`<br><br>`.categoryIds`* | list of integers | List
                    of Chainalysis category IDs (see
                    [here](https://docs.chainalysis.com/api/kyt/#categories)).
                    If you leave this list empty, alerts of any category will
                    trigger the rule. Otherwise, if you only want the rule to
                    trigger on specific categories, you can specify some in the
                    list. |

                    | `exposures`<br><br>`.direct`<br><br>`.categoryIds`* | list
                    of integers | List of Chainalysis category IDs (see
                    [here](https://docs.chainalysis.com/api/kyt/#categories)).
                    If you leave this list empty, a [direct
                    exposure](https://docs.chainalysis.com/api/kyt/#withdrawal-attempts-get-direct-exposure)
                    of any category detected by chainalysis will trigger the
                    rule. Otherwise, if you only want the rule to trigger on
                    specific categories, you can specify some in the list. |

                    | `addresses`<br><br>`.categoryIds`* | list of integers |
                    List of Chainalysis category IDs (see
                    [here](https://docs.chainalysis.com/api/kyt/#categories)).
                    If you leave this list empty, an
                    [address](https://docs.chainalysis.com/api/kyt/#withdrawal-attempts-get-address-identifications)
                    of any category identified by chainalysis will trigger the
                    rule. Otherwise, if you only want the rule to trigger on
                    specific categories, you can specify some in the list. |

                    |
                    `fallbackBehaviours`<br><br>`.skipUnscreenableTransaction`*
                    | boolean | Behaviour if the wallet activity is not
                    screenable (eg. if it's a signature request of a hash). If
                    true, a transaction which is "unscreenable" will just be
                    skipped, and policy will not trigger |

                    | `fallbackBehaviours.skipUnsupportedNetwork`* | boolean |
                    Behaviour if the wallet activity is on a network not
                    supported by chainalysis, or not yet supported in the
                    dfns-chainalysis integration. If true, an unsupported
                    network will just be skipped, and policy will not trigger |

                    | `fallbackBehaviours.skipUnsupportedAsset`* | boolean |
                    Behaviour if the wallet activity is with a asset not
                    supported by chainalysis, or not yet supported in the
                    dfns-chainalysis integration. If true, an unsupported asset
                    will just be skipped, and policy will not trigger |

                    | `fallbackBehaviours.skipChainalysisFailure`* | boolean |
                    Behaviour if any issue with Chainalysis calls (timeout,
                    results took too long, rate limiting errors, any error). If
                    true, will skip if any error happens |

                  title: ChainalysisTransactionPrescreening
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - EllipticTransactionPrescreening
                    configuration:
                      type: object
                      properties:
                        riskScoreThreshold:
                          type: number
                          minimum: 0
                          maximum: 10
                          description: >-
                            Risk score threshold (0-10, decimals allowed). The
                            policy triggers if the Elliptic risk score is at or
                            above the threshold.
                        triggeredRules:
                          type: object
                          properties:
                            ruleIds:
                              type: array
                              items:
                                type: string
                                format: uuid
                              description: >-
                                IDs of risk rules from your Elliptic risk model.
                                If any of these rules matched the analysis, the
                                policy triggers regardless of the risk score.
                                Leave empty to trigger on the risk score
                                threshold only.
                            categories:
                              type: array
                              items:
                                type: string
                                minLength: 1
                              description: >-
                                Elliptic category names (eg. "Dark Market"),
                                matched case-insensitively. If a matched risk
                                rule involves any of these categories, the
                                policy triggers regardless of the risk score.
                                Leave empty to trigger on the risk score
                                threshold only.
                          required:
                            - ruleIds
                            - categories
                        fallbackBehaviours:
                          type: object
                          properties:
                            skipUnscreenableTransaction:
                              type: boolean
                              description: >-
                                skip all wallet requests that cannot be screened
                                (eg. raw signatures)
                            skipUnsupportedNetwork:
                              type: boolean
                              description: >-
                                skip requests on a network not supported yet in
                                our Elliptic integration
                            skipEllipticFailure:
                              type: boolean
                              description: >-
                                skip any failure of the Elliptic analysis
                                (timeout, rate limiting, any error)
                          required:
                            - skipUnscreenableTransaction
                            - skipUnsupportedNetwork
                            - skipEllipticFailure
                      required:
                        - riskScoreThreshold
                        - triggeredRules
                        - fallbackBehaviours
                      additionalProperties: false
                  required:
                    - kind
                    - configuration
                  additionalProperties: false
                  description: >-

                    <Info>

                    This rule can only be used once the Elliptic integration is
                    activated from the Dfns dashboard settings.

                    </Info>


                    This rule uses Elliptic KYT for pre-screening outgoing
                    transfers. Upon transfer attempt, we run a synchronous
                    Elliptic wallet analysis of the destination address, and
                    check the returned risk score against the configured
                    threshold, plus any configured risk rules / categories. If
                    at or above the threshold, or if a configured rule /
                    category matched, the policy is triggered.


                    It's called "Pre"-screening, because the scanned transaction
                    is not on chain yet, it's still a transaction attempt.
                  title: EllipticTransactionPrescreening
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - GlobalLedgerTransactionPrescreening
                    configuration:
                      type: object
                      properties:
                        riskScoreThreshold:
                          type: integer
                          minimum: 0
                          maximum: 100
                          description: >-
                            Risk score threshold (0-100). Policy triggers if
                            address/transaction risk score >= threshold
                        fallbackBehaviours:
                          type: object
                          properties:
                            skipUnscreenableTransaction:
                              type: boolean
                              description: >-
                                skip all wallet requests that cannot be screened
                                (eg. raw signatures)
                            skipUnsupportedNetwork:
                              type: boolean
                              description: >-
                                skip transfer requests to a network not
                                supported yet in our GlobalLedger integration
                            skipUnsupportedAsset:
                              type: boolean
                              description: >-
                                skip transfer requests of an asset not supported
                                by our GlobalLedger integration
                            skipGlobalLedgerFailure:
                              type: boolean
                              description: skips any errors from GlobalLedger API request
                          required:
                            - skipUnscreenableTransaction
                            - skipUnsupportedNetwork
                            - skipUnsupportedAsset
                            - skipGlobalLedgerFailure
                      required:
                        - riskScoreThreshold
                        - fallbackBehaviours
                      additionalProperties: false
                  required:
                    - kind
                    - configuration
                  additionalProperties: false
                  description: >-
                    This rule uses GlobalLedger KYT for pre-screening outgoing
                    transfers by checking the destination address risk score.


                    Upon transfer attempt, we will query GlobalLedger's address
                    risk API, and check if the risk score (0-100) is at or above
                    the configured threshold, or if any alerts show up. If so,
                    the policy will be triggered.


                    It's called "Pre"-screening, because the scanned transaction
                    is not on chain yet, it's still a transaction attempt.
                  title: GlobalLedgerTransactionPrescreening
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - TravelRuleTransactionPrescreening
                    configuration:
                      oneOf:
                        - type: object
                          properties:
                            vendor:
                              type: string
                              enum:
                                - Notabene
                            autoTriggerTimeoutSeconds:
                              type: integer
                              minimum: 0
                            autoClearAfterDeliveredTimeoutSeconds:
                              type: integer
                              minimum: 0
                          required:
                            - vendor
                            - autoTriggerTimeoutSeconds
                          additionalProperties: false
                          title: TravelRuleNotabeneConfiguration
                        - type: object
                          properties:
                            vendor:
                              type: string
                              enum:
                                - Sumsub
                            autoTriggerTimeoutSeconds:
                              type: integer
                              minimum: 0
                          required:
                            - vendor
                            - autoTriggerTimeoutSeconds
                          additionalProperties: false
                          title: TravelRuleSumsubConfiguration
                  required:
                    - kind
                    - configuration
                  additionalProperties: false
                  description: >-
                    This rule can only be used once the Notabene integration is
                    activated from the Dfns dashboard settings (see more on
                    [Notabene](https://docs.dfns.co/integrations/travel-rule/notabene)
                    integration page).
                        
                        It's a rule based on [Notabene Travel Rule](https://docs.dfns.co/integrations/travel-rule/notabene) integration. It ***ONLY*** applies to Dfns [Transfer Asset](https://docs.dfns.co/api-reference/wallets/transfer-asset) Api Calls. It is NOT supported for Transfers initiated via the dashboard. Upon transfer attempt with an optional [TravelRule](https://docs.dfns.co/api-reference/wallets/transfer-asset#body-travel-rule) payload, we will call Notabene's APIs on your behalf to both confirm the validity of the travel rule message and submit it for processing. Dfns then waits for a response from the counterparty (for custodial transfers) or Notabene (for non-custodial transfers).

                    The travel-rule vendor is determined by this rule's
                    `configuration.vendor`, and the transfer's `travelRule`
                    payload must be of the matching kind — a mismatch blocks the
                    transfer. Because of this, a given wallet must be covered by
                    travel-rule policies of a single vendor: scoping two
                    travel-rule policies of different vendors to the same wallet
                    would block every transfer to it (whichever payload is sent
                    always mismatches the other vendor's rule).


                    It's called "Pre"-screening, because the transaction is not
                    on chain yet, it's still a transaction attempt (before the
                    transaction actually make it on chain).
                  title: TravelRuleTransactionPrescreening
            action:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - RequestApproval
                    approvalGroups:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                          quorum:
                            type: integer
                            minimum: 1
                          approvers:
                            type: object
                            properties:
                              userId:
                                type: object
                                properties:
                                  in:
                                    type: array
                                    items:
                                      type: string
                                      minLength: 1
                                    minItems: 1
                                    maxItems: 100
                                required:
                                  - in
                                additionalProperties: false
                            additionalProperties: false
                          initiatorCanApprove:
                            type: boolean
                            description: >-
                              Whether the initiator of the activity can
                              participate in the approval.
                          serviceAccountsCanApprove:
                            type: boolean
                            description: >-
                              Whether service accounts can participate in the
                              approval for this group.
                        required:
                          - quorum
                          - approvers
                        additionalProperties: false
                      minItems: 1
                    autoRejectTimeout:
                      type:
                        - integer
                        - 'null'
                      minimum: 1
                  required:
                    - kind
                    - approvalGroups
                  additionalProperties: false
                  description: >-

                    This action means that activity will first require an
                    Approval process to be completed before it can  be executed
                    (or be aborted if someone rejects it during the approval
                    process).


                    One or several groups of approvers need to be specified.
                    These groups define who is allowed to approve / reject an
                    activity.


                    The activity will only be executed if all approver groups
                    reach their "quorum" of approvals. Otherwise, if any one
                    user within any approver group rejects, then the activity is
                    aborted and the call is not executed.


                    The example below shows a `RequestApproval` action,
                    configured with one approval group requiring 2 approvals
                    amongst three specific users.


                    ```json

                    {
                      "action": {
                        "kind": "RequestApproval",
                        "autoRejectTimeout": 60, // minutes
                        "approvalGroups": [
                          {
                            "name": "Admins",
                            "quorum": 2, // only 2 approvers required in that group 
                            "approvers": {
                              "userId": {
                                "in": ["us-...1", "us-...2", "us-...3"],
                              }
                            }
                          }
                        ],

                      }
                    }

                    ```


                    **Don't lock yourself up**


                    By default, users cannot approve an activity they initiated
                    themselves, even if they are in an approval group. To allow
                    this, you must set `initiatorCanApprove: true`.


                    *Example 1:* For any wallet transfer, a policy is setup to
                    require approval from **1 specific admin user** (eg. the
                    CEO). `initiatorCanApprove` was not set to `true`. If the
                    CEO himself initiates a transfer, no-one can approve his
                    transfer and it's stuck.


                    *Example 2:* Company has only 3 users. A policy is setup to
                    require approval from **any 3 users** (`quorum: 3`) for any
                    modification of a policy. `initiatorCanApprove` was not set
                    to `true`. In this case, they are locked, and the policy
                    cannot be modified: whoever requests a modification cannot
                    approve, and the policy is therefore always missing one
                    approver. To unlock, they would need to invite a new user
                    and give him the rights to approve as well.
                        
                  title: RequestApproval
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Block
                  required:
                    - kind
                  additionalProperties: false
                  description: >
                    This action means that the activity will be blocked if the
                    policy is triggered.


                    ```json

                    {
                      "action": {
                        "kind": "Block"
                      }
                    }

                    ```
                  title: Block
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - NoAction
                  required:
                    - kind
                  additionalProperties: false
                  description: |2-

                        This action kind means that nothing will happen after policy rule evaluation. It's meant to be used with policy rules "`ChainalysisTransactionPrescreening`" or "`ChainalysisTransactionScreening`". This action is for when you just want the KYT analysis rule to be run, and then if triggered, those result returned in a `policy.triggered` [Webhook Event](https://docs.dfns.co/api-reference/webhook-events).

                    ```json
                    {
                      "action": {
                        "kind": "NoAction"
                      }
                    }
                    ```
                        
                  title: NoAction
            filters:
              type: object
              properties:
                walletId:
                  type: object
                  properties:
                    in:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  required:
                    - in
                  additionalProperties: false
                walletTags:
                  type: object
                  properties:
                    hasAny:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                    hasAll:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  additionalProperties: false
              additionalProperties: false
          required:
            - id
            - name
            - status
            - activityKind
            - rule
            - action
          additionalProperties: false
          title: Wallets:Sign
        - type: object
          properties:
            id:
              type: string
            name:
              type: string
            status:
              type: string
              enum:
                - Active
                - Archived
            dateCreated:
              type: string
            dateUpdated:
              type: string
            activityKind:
              type: string
              enum:
                - Wallets:IncomingTransaction
            rule:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - ChainalysisTransactionScreening
                    configuration:
                      type: object
                      properties:
                        alerts:
                          type: object
                          properties:
                            alertLevel:
                              type: string
                              enum:
                                - LOW
                                - MEDIUM
                                - HIGH
                                - SEVERE
                            categoryIds:
                              type: array
                              items:
                                type: integer
                                exclusiveMinimum: 0
                          required:
                            - alertLevel
                            - categoryIds
                        exposures:
                          type: object
                          properties:
                            direct:
                              type: object
                              properties:
                                categoryIds:
                                  type: array
                                  items:
                                    type: integer
                                    exclusiveMinimum: 0
                              required:
                                - categoryIds
                          required:
                            - direct
                        userIdTemplate:
                          type: string
                          minLength: 1
                          maxLength: 50
                          pattern: >-
                            ^([a-zA-Z0-9_:-]|{wallet\.id}|{wallet\.externalId})+$
                          default: dfns
                          description: >-
                            **Deprecated** — set `userIdTemplate` on the
                            Chainalysis integration setting instead; when set
                            there, the integration-level template takes
                            precedence over this one.


                            Value sent to Chainalysis as the "user ID". Used by
                            Chainalysis for grouping transaction screenings.
                              
                            This template can include variables, included in
                            brackets. The following variables are currently
                            supported:  `{wallet.id}` and `{wallet.externalId}`.

                            As an example, if you set `userIdTemplate:
                            "dfns:{wallet.id}_{wallet.externalId}"`, when your
                            wallet receives a transaction that gets screened by
                            a Chainalysis policy, the "user ID" sent to
                            Chainalysis will be `dfns:wa-xxx_yyy` (`wa-xxx`
                            being the wallet ID, and `yyy` being the wallet
                            external ID).
                        fallbackBehaviours:
                          type: object
                          properties:
                            skipUnscreenableTransaction:
                              type: boolean
                            skipUnsupportedNetwork:
                              type: boolean
                            skipUnsupportedAsset:
                              type: boolean
                            skipChainalysisFailure:
                              type: boolean
                          required:
                            - skipUnscreenableTransaction
                            - skipUnsupportedNetwork
                            - skipUnsupportedAsset
                            - skipChainalysisFailure
                      required:
                        - alerts
                        - exposures
                        - fallbackBehaviours
                      additionalProperties: false
                  required:
                    - kind
                    - configuration
                  additionalProperties: false
                  description: >

                    <Info>

                    This rule can only be used once the Chainalysis integration
                    is activated from the Dfns dashboard settings. (see more on
                    [Chainalysis](https://docs.dfns.co/integrations/aml-kyt/chainalysis)
                    integration page).

                    </Info>


                    This rule can be used on a policy of `activityKind` =
                    `Wallets:IncomingTransaction`, and with the action kind
                    `NoAction`. It's a rule based on Chainalysis KYT integration
                    (Know-Your-Transaction). Upon an incoming transaction
                    detectedby our indexers, we will [register the transfer with
                    Chainalysis](https://docs.chainalysis.com/api/kyt/#registration-register-a-transfer),
                    and fetch the results of the analysis (alerts & exposures
                    detected). Based on the results, and the configuration of
                    this rule, the policy will be triggered.


                    The shape of the rule is almost like the
                    `ChainalysisTransactionPrescreening` rule, expect the the
                    `address` property is not supported.


                    ```json

                    {
                      "rule": {
                        "kind": "ChainalysisTransactionPrescreening",
                        "configuration": {
                          "alerts": {
                            "alertLevel": "LOW",
                            "categoryIds": []
                          },
                          "exposures": {
                            "direct": {
                              "categoryIds": []
                            }
                          },
                          "fallbackBehaviours": {
                            "skipUnscreenableTransaction": false,
                            "skipUnsupportedNetwork": false,
                            "skipUnsupportedAsset": false,
                            "skipChainalysisFailure": false
                          }
                        }
                      }
                    }

                    ```


                    **Configuration**


                    Please refer to the configuration for the
                    `ChainalysisTransactionPrescreening` rule.
                  title: ChainalysisTransactionScreening
            action:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - NoAction
                  required:
                    - kind
                  additionalProperties: false
                  description: |2-

                        This action kind means that nothing will happen after policy rule evaluation. It's meant to be used with policy rules "`ChainalysisTransactionPrescreening`" or "`ChainalysisTransactionScreening`". This action is for when you just want the KYT analysis rule to be run, and then if triggered, those result returned in a `policy.triggered` [Webhook Event](https://docs.dfns.co/api-reference/webhook-events).

                    ```json
                    {
                      "action": {
                        "kind": "NoAction"
                      }
                    }
                    ```
                        
                  title: NoAction
            filters:
              type: object
              properties:
                walletId:
                  type: object
                  properties:
                    in:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  required:
                    - in
                  additionalProperties: false
                walletTags:
                  type: object
                  properties:
                    hasAny:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                    hasAll:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  additionalProperties: false
              additionalProperties: false
          required:
            - id
            - name
            - status
            - activityKind
            - rule
            - action
          additionalProperties: false
          title: Wallets:IncomingTransaction
        - type: object
          properties:
            id:
              type: string
            name:
              type: string
            status:
              type: string
              enum:
                - Active
                - Archived
            dateCreated:
              type: string
            dateUpdated:
              type: string
            activityKind:
              type: string
              enum:
                - Vaults:ReleaseQuarantine
            rule:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - AlwaysTrigger
                    configuration:
                      type: object
                      properties: {}
                      additionalProperties: false
                  required:
                    - kind
                  additionalProperties: false
                  description: >-
                    This rule will always be triggered, meaning that if this
                    rule is defined on a policy, the policy will always trigger
                    the policy action, regardless of the activity details.
                  title: AlwaysTrigger
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - ChainalysisQuarantineScreening
                    configuration:
                      type: object
                      properties:
                        alerts:
                          type: object
                          properties:
                            alertLevel:
                              type: string
                              enum:
                                - LOW
                                - MEDIUM
                                - HIGH
                                - SEVERE
                            categoryIds:
                              type: array
                              items:
                                type: integer
                                exclusiveMinimum: 0
                          required:
                            - alertLevel
                            - categoryIds
                        exposures:
                          type: object
                          properties:
                            direct:
                              type: object
                              properties:
                                categoryIds:
                                  type: array
                                  items:
                                    type: integer
                                    exclusiveMinimum: 0
                              required:
                                - categoryIds
                          required:
                            - direct
                      required:
                        - alerts
                        - exposures
                      additionalProperties: false
                  required:
                    - kind
                    - configuration
                  additionalProperties: false
                  description: >

                    <Info>

                    This rule can only be used once the Chainalysis integration
                    is activated from the Dfns dashboard settings. (see more on
                    [Chainalysis](https://docs.dfns.co/integrations/aml-kyt/chainalysis)
                    integration page).

                    </Info>


                    This rule can be used on a policy of `activityKind` =
                    `Vaults:ReleaseQuarantine`. When a quarantined vault deposit
                    was screened by Chainalysis KYT, the screening result
                    (alerts & direct exposure) is stored with the quarantine.
                    When a release of the quarantined funds is requested, this
                    rule evaluates that **stored** result — no new Chainalysis
                    call is made. Based on the stored result and the
                    configuration of this rule, the policy will be triggered.


                    If the quarantine has **no stored KYT result** (the result
                    was not received yet, the network/asset is not supported by
                    the Chainalysis integration, or screening failed), the rule
                    **always triggers** (fail closed): the release then follows
                    the policy action (approval or block).


                    ```json

                    {
                      "rule": {
                        "kind": "ChainalysisQuarantineScreening",
                        "configuration": {
                          "alerts": {
                            "alertLevel": "LOW",
                            "categoryIds": []
                          },
                          "exposures": {
                            "direct": {
                              "categoryIds": []
                            }
                          }
                        }
                      }
                    }

                    ```


                    **Configuration**


                    | Property | Type | Description |

                    | --- | --- | --- |

                    | `alerts`<br><br>`.alertLevel`* | `string` | Minimum alert
                    level above which the rule should trigger, if any alert was
                    returned in the stored Chainalysis results. Can be `LOW`,
                    `MEDIUM`, `HIGH`, or `SEVERE` |

                    | `alerts`<br><br>`.categoryIds`* | list of integers | List
                    of Chainalysis category IDs (see
                    [here](https://docs.chainalysis.com/api/kyt/#categories)).
                    If you leave this list empty, alerts of any category will
                    trigger the rule. Otherwise, if you only want the rule to
                    trigger on specific categories, you can specify some in the
                    list. |

                    | `exposures`<br><br>`.direct`<br><br>`.categoryIds`* | list
                    of integers | List of Chainalysis category IDs (see
                    [here](https://docs.chainalysis.com/api/kyt/#categories)).
                    If you leave this list empty, a direct exposure of any
                    category in the stored results will trigger the rule.
                    Otherwise, if you only want the rule to trigger on specific
                    categories, you can specify some in the list. |
                  title: ChainalysisQuarantineScreening
            action:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - RequestApproval
                    approvalGroups:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                          quorum:
                            type: integer
                            minimum: 1
                          approvers:
                            type: object
                            properties:
                              userId:
                                type: object
                                properties:
                                  in:
                                    type: array
                                    items:
                                      type: string
                                      minLength: 1
                                    minItems: 1
                                    maxItems: 100
                                required:
                                  - in
                                additionalProperties: false
                            additionalProperties: false
                          initiatorCanApprove:
                            type: boolean
                            description: >-
                              Whether the initiator of the activity can
                              participate in the approval.
                          serviceAccountsCanApprove:
                            type: boolean
                            description: >-
                              Whether service accounts can participate in the
                              approval for this group.
                        required:
                          - quorum
                          - approvers
                        additionalProperties: false
                      minItems: 1
                    autoRejectTimeout:
                      type:
                        - integer
                        - 'null'
                      minimum: 1
                  required:
                    - kind
                    - approvalGroups
                  additionalProperties: false
                  description: >-

                    This action means that activity will first require an
                    Approval process to be completed before it can  be executed
                    (or be aborted if someone rejects it during the approval
                    process).


                    One or several groups of approvers need to be specified.
                    These groups define who is allowed to approve / reject an
                    activity.


                    The activity will only be executed if all approver groups
                    reach their "quorum" of approvals. Otherwise, if any one
                    user within any approver group rejects, then the activity is
                    aborted and the call is not executed.


                    The example below shows a `RequestApproval` action,
                    configured with one approval group requiring 2 approvals
                    amongst three specific users.


                    ```json

                    {
                      "action": {
                        "kind": "RequestApproval",
                        "autoRejectTimeout": 60, // minutes
                        "approvalGroups": [
                          {
                            "name": "Admins",
                            "quorum": 2, // only 2 approvers required in that group 
                            "approvers": {
                              "userId": {
                                "in": ["us-...1", "us-...2", "us-...3"],
                              }
                            }
                          }
                        ],

                      }
                    }

                    ```


                    **Don't lock yourself up**


                    By default, users cannot approve an activity they initiated
                    themselves, even if they are in an approval group. To allow
                    this, you must set `initiatorCanApprove: true`.


                    *Example 1:* For any wallet transfer, a policy is setup to
                    require approval from **1 specific admin user** (eg. the
                    CEO). `initiatorCanApprove` was not set to `true`. If the
                    CEO himself initiates a transfer, no-one can approve his
                    transfer and it's stuck.


                    *Example 2:* Company has only 3 users. A policy is setup to
                    require approval from **any 3 users** (`quorum: 3`) for any
                    modification of a policy. `initiatorCanApprove` was not set
                    to `true`. In this case, they are locked, and the policy
                    cannot be modified: whoever requests a modification cannot
                    approve, and the policy is therefore always missing one
                    approver. To unlock, they would need to invite a new user
                    and give him the rights to approve as well.
                        
                  title: RequestApproval
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Block
                  required:
                    - kind
                  additionalProperties: false
                  description: >
                    This action means that the activity will be blocked if the
                    policy is triggered.


                    ```json

                    {
                      "action": {
                        "kind": "Block"
                      }
                    }

                    ```
                  title: Block
            filters:
              type: object
              properties:
                vaultId:
                  type: object
                  properties:
                    in:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  required:
                    - in
                  additionalProperties: false
                vaultTags:
                  type: object
                  properties:
                    hasAny:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                    hasAll:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  additionalProperties: false
              additionalProperties: false
          required:
            - id
            - name
            - status
            - activityKind
            - rule
            - action
          additionalProperties: false
          title: Vaults:ReleaseQuarantine
        - type: object
          properties:
            id:
              type: string
            name:
              type: string
            status:
              type: string
              enum:
                - Active
                - Archived
            dateCreated:
              type: string
            dateUpdated:
              type: string
            activityKind:
              type: string
              enum:
                - Vaults:CreateLock
            rule:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - AlwaysTrigger
                    configuration:
                      type: object
                      properties: {}
                      additionalProperties: false
                  required:
                    - kind
                  additionalProperties: false
                  description: >-
                    This rule will always be triggered, meaning that if this
                    rule is defined on a policy, the policy will always trigger
                    the policy action, regardless of the activity details.
                  title: AlwaysTrigger
            action:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - RequestApproval
                    approvalGroups:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                          quorum:
                            type: integer
                            minimum: 1
                          approvers:
                            type: object
                            properties:
                              userId:
                                type: object
                                properties:
                                  in:
                                    type: array
                                    items:
                                      type: string
                                      minLength: 1
                                    minItems: 1
                                    maxItems: 100
                                required:
                                  - in
                                additionalProperties: false
                            additionalProperties: false
                          initiatorCanApprove:
                            type: boolean
                            description: >-
                              Whether the initiator of the activity can
                              participate in the approval.
                          serviceAccountsCanApprove:
                            type: boolean
                            description: >-
                              Whether service accounts can participate in the
                              approval for this group.
                        required:
                          - quorum
                          - approvers
                        additionalProperties: false
                      minItems: 1
                    autoRejectTimeout:
                      type:
                        - integer
                        - 'null'
                      minimum: 1
                  required:
                    - kind
                    - approvalGroups
                  additionalProperties: false
                  description: >-

                    This action means that activity will first require an
                    Approval process to be completed before it can  be executed
                    (or be aborted if someone rejects it during the approval
                    process).


                    One or several groups of approvers need to be specified.
                    These groups define who is allowed to approve / reject an
                    activity.


                    The activity will only be executed if all approver groups
                    reach their "quorum" of approvals. Otherwise, if any one
                    user within any approver group rejects, then the activity is
                    aborted and the call is not executed.


                    The example below shows a `RequestApproval` action,
                    configured with one approval group requiring 2 approvals
                    amongst three specific users.


                    ```json

                    {
                      "action": {
                        "kind": "RequestApproval",
                        "autoRejectTimeout": 60, // minutes
                        "approvalGroups": [
                          {
                            "name": "Admins",
                            "quorum": 2, // only 2 approvers required in that group 
                            "approvers": {
                              "userId": {
                                "in": ["us-...1", "us-...2", "us-...3"],
                              }
                            }
                          }
                        ],

                      }
                    }

                    ```


                    **Don't lock yourself up**


                    By default, users cannot approve an activity they initiated
                    themselves, even if they are in an approval group. To allow
                    this, you must set `initiatorCanApprove: true`.


                    *Example 1:* For any wallet transfer, a policy is setup to
                    require approval from **1 specific admin user** (eg. the
                    CEO). `initiatorCanApprove` was not set to `true`. If the
                    CEO himself initiates a transfer, no-one can approve his
                    transfer and it's stuck.


                    *Example 2:* Company has only 3 users. A policy is setup to
                    require approval from **any 3 users** (`quorum: 3`) for any
                    modification of a policy. `initiatorCanApprove` was not set
                    to `true`. In this case, they are locked, and the policy
                    cannot be modified: whoever requests a modification cannot
                    approve, and the policy is therefore always missing one
                    approver. To unlock, they would need to invite a new user
                    and give him the rights to approve as well.
                        
                  title: RequestApproval
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Block
                  required:
                    - kind
                  additionalProperties: false
                  description: >
                    This action means that the activity will be blocked if the
                    policy is triggered.


                    ```json

                    {
                      "action": {
                        "kind": "Block"
                      }
                    }

                    ```
                  title: Block
            filters:
              type: object
              properties:
                vaultId:
                  type: object
                  properties:
                    in:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  required:
                    - in
                  additionalProperties: false
                vaultTags:
                  type: object
                  properties:
                    hasAny:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                    hasAll:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  additionalProperties: false
              additionalProperties: false
          required:
            - id
            - name
            - status
            - activityKind
            - rule
            - action
          additionalProperties: false
          title: Vaults:CreateLock
        - type: object
          properties:
            id:
              type: string
            name:
              type: string
            status:
              type: string
              enum:
                - Active
                - Archived
            dateCreated:
              type: string
            dateUpdated:
              type: string
            activityKind:
              type: string
              enum:
                - Vaults:ReplaceLock
            rule:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - AlwaysTrigger
                    configuration:
                      type: object
                      properties: {}
                      additionalProperties: false
                  required:
                    - kind
                  additionalProperties: false
                  description: >-
                    This rule will always be triggered, meaning that if this
                    rule is defined on a policy, the policy will always trigger
                    the policy action, regardless of the activity details.
                  title: AlwaysTrigger
            action:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - RequestApproval
                    approvalGroups:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                          quorum:
                            type: integer
                            minimum: 1
                          approvers:
                            type: object
                            properties:
                              userId:
                                type: object
                                properties:
                                  in:
                                    type: array
                                    items:
                                      type: string
                                      minLength: 1
                                    minItems: 1
                                    maxItems: 100
                                required:
                                  - in
                                additionalProperties: false
                            additionalProperties: false
                          initiatorCanApprove:
                            type: boolean
                            description: >-
                              Whether the initiator of the activity can
                              participate in the approval.
                          serviceAccountsCanApprove:
                            type: boolean
                            description: >-
                              Whether service accounts can participate in the
                              approval for this group.
                        required:
                          - quorum
                          - approvers
                        additionalProperties: false
                      minItems: 1
                    autoRejectTimeout:
                      type:
                        - integer
                        - 'null'
                      minimum: 1
                  required:
                    - kind
                    - approvalGroups
                  additionalProperties: false
                  description: >-

                    This action means that activity will first require an
                    Approval process to be completed before it can  be executed
                    (or be aborted if someone rejects it during the approval
                    process).


                    One or several groups of approvers need to be specified.
                    These groups define who is allowed to approve / reject an
                    activity.


                    The activity will only be executed if all approver groups
                    reach their "quorum" of approvals. Otherwise, if any one
                    user within any approver group rejects, then the activity is
                    aborted and the call is not executed.


                    The example below shows a `RequestApproval` action,
                    configured with one approval group requiring 2 approvals
                    amongst three specific users.


                    ```json

                    {
                      "action": {
                        "kind": "RequestApproval",
                        "autoRejectTimeout": 60, // minutes
                        "approvalGroups": [
                          {
                            "name": "Admins",
                            "quorum": 2, // only 2 approvers required in that group 
                            "approvers": {
                              "userId": {
                                "in": ["us-...1", "us-...2", "us-...3"],
                              }
                            }
                          }
                        ],

                      }
                    }

                    ```


                    **Don't lock yourself up**


                    By default, users cannot approve an activity they initiated
                    themselves, even if they are in an approval group. To allow
                    this, you must set `initiatorCanApprove: true`.


                    *Example 1:* For any wallet transfer, a policy is setup to
                    require approval from **1 specific admin user** (eg. the
                    CEO). `initiatorCanApprove` was not set to `true`. If the
                    CEO himself initiates a transfer, no-one can approve his
                    transfer and it's stuck.


                    *Example 2:* Company has only 3 users. A policy is setup to
                    require approval from **any 3 users** (`quorum: 3`) for any
                    modification of a policy. `initiatorCanApprove` was not set
                    to `true`. In this case, they are locked, and the policy
                    cannot be modified: whoever requests a modification cannot
                    approve, and the policy is therefore always missing one
                    approver. To unlock, they would need to invite a new user
                    and give him the rights to approve as well.
                        
                  title: RequestApproval
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Block
                  required:
                    - kind
                  additionalProperties: false
                  description: >
                    This action means that the activity will be blocked if the
                    policy is triggered.


                    ```json

                    {
                      "action": {
                        "kind": "Block"
                      }
                    }

                    ```
                  title: Block
            filters:
              type: object
              properties:
                vaultId:
                  type: object
                  properties:
                    in:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  required:
                    - in
                  additionalProperties: false
                vaultTags:
                  type: object
                  properties:
                    hasAny:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                    hasAll:
                      type: array
                      items:
                        type: string
                        minLength: 1
                      minItems: 1
                      maxItems: 100
                  additionalProperties: false
              additionalProperties: false
          required:
            - id
            - name
            - status
            - activityKind
            - rule
            - action
          additionalProperties: false
          title: Vaults:ReplaceLock
        - type: object
          properties:
            id:
              type: string
            name:
              type: string
            status:
              type: string
              enum:
                - Active
                - Archived
            dateCreated:
              type: string
            dateUpdated:
              type: string
            activityKind:
              type: string
              enum:
                - UserAction
            rule:
              type: object
              properties:
                kind:
                  type: string
                  enum:
                    - UserAction
                configuration:
                  type: object
                  properties:
                    userActionKinds:
                      type: array
                      items:
                        type: string
                  required:
                    - userActionKinds
                  additionalProperties: false
              required:
                - kind
                - configuration
              additionalProperties: false
              title: UserAction
            action:
              oneOf:
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - RequestApproval
                    approvalGroups:
                      type: array
                      items:
                        type: object
                        properties:
                          name:
                            type: string
                          quorum:
                            type: integer
                            minimum: 1
                          approvers:
                            type: object
                            properties:
                              userId:
                                type: object
                                properties:
                                  in:
                                    type: array
                                    items:
                                      type: string
                                      minLength: 1
                                    minItems: 1
                                    maxItems: 100
                                required:
                                  - in
                                additionalProperties: false
                            additionalProperties: false
                          initiatorCanApprove:
                            type: boolean
                            description: >-
                              Whether the initiator of the activity can
                              participate in the approval.
                          serviceAccountsCanApprove:
                            type: boolean
                            description: >-
                              Whether service accounts can participate in the
                              approval for this group.
                        required:
                          - quorum
                          - approvers
                        additionalProperties: false
                      minItems: 1
                    autoRejectTimeout:
                      type:
                        - integer
                        - 'null'
                      minimum: 1
                  required:
                    - kind
                    - approvalGroups
                  additionalProperties: false
                  description: >-

                    This action means that activity will first require an
                    Approval process to be completed before it can  be executed
                    (or be aborted if someone rejects it during the approval
                    process).


                    One or several groups of approvers need to be specified.
                    These groups define who is allowed to approve / reject an
                    activity.


                    The activity will only be executed if all approver groups
                    reach their "quorum" of approvals. Otherwise, if any one
                    user within any approver group rejects, then the activity is
                    aborted and the call is not executed.


                    The example below shows a `RequestApproval` action,
                    configured with one approval group requiring 2 approvals
                    amongst three specific users.


                    ```json

                    {
                      "action": {
                        "kind": "RequestApproval",
                        "autoRejectTimeout": 60, // minutes
                        "approvalGroups": [
                          {
                            "name": "Admins",
                            "quorum": 2, // only 2 approvers required in that group 
                            "approvers": {
                              "userId": {
                                "in": ["us-...1", "us-...2", "us-...3"],
                              }
                            }
                          }
                        ],

                      }
                    }

                    ```


                    **Don't lock yourself up**


                    By default, users cannot approve an activity they initiated
                    themselves, even if they are in an approval group. To allow
                    this, you must set `initiatorCanApprove: true`.


                    *Example 1:* For any wallet transfer, a policy is setup to
                    require approval from **1 specific admin user** (eg. the
                    CEO). `initiatorCanApprove` was not set to `true`. If the
                    CEO himself initiates a transfer, no-one can approve his
                    transfer and it's stuck.


                    *Example 2:* Company has only 3 users. A policy is setup to
                    require approval from **any 3 users** (`quorum: 3`) for any
                    modification of a policy. `initiatorCanApprove` was not set
                    to `true`. In this case, they are locked, and the policy
                    cannot be modified: whoever requests a modification cannot
                    approve, and the policy is therefore always missing one
                    approver. To unlock, they would need to invite a new user
                    and give him the rights to approve as well.
                        
                  title: RequestApproval
                - type: object
                  properties:
                    kind:
                      type: string
                      enum:
                        - Block
                  required:
                    - kind
                  additionalProperties: false
                  description: >
                    This action means that the activity will be blocked if the
                    policy is triggered.


                    ```json

                    {
                      "action": {
                        "kind": "Block"
                      }
                    }

                    ```
                  title: Block
            filters:
              type: object
              properties: {}
          required:
            - id
            - name
            - status
            - activityKind
            - rule
            - action
          additionalProperties: false
          title: UserAction
  securitySchemes:
    authenticationToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: >-
        **Bearer Token:** Used to authenticate API requests.

        More details how to generate the token: [Authentication
        flows](https://docs.dfns.co/api-reference/auth/login-flows)
    userActionSignature:
      type: apiKey
      in: header
      name: X-DFNS-USERACTION
      description: >-
        **User Action Signature:** Used to sign the change-inducing API
        requests.

        More details how to generate the token: [User Action Signing
        flows](https://docs.dfns.co/api-reference/auth/signing-flows)

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.