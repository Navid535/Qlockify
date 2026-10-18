"""
    membership_api_permissions 64.28571428571429/90
        test_membership_list_requires_authentication PASS
            test score ratio: 6.428571428571429/90
            test time: 0.014
        test_membership_list_is_limited_to_visible_workspaces PASS
            test score ratio: 6.428571428571429/90
            test time: 0.030
        test_membership_list_can_be_filtered_by_workspace PASS
            test score ratio: 6.428571428571429/90
            test time: 0.029
        test_owner_can_add_workspace_member PASS
            test score ratio: 6.428571428571429/90
            test time: 0.020
        test_admin_can_add_workspace_member PASS
            test score ratio: 6.428571428571429/90
            test time: 0.022
        test_member_cannot_add_workspace_member PASS
            test score ratio: 6.428571428571429/90
            test time: 0.021
        test_membership_create_accepts_user_alias_payload PASS
            test score ratio: 6.428571428571429/90
            test time: 0.021
        test_duplicate_workspace_membership_is_rejected FAIL
            test score ratio: 6.428571428571429/90
            test time: 0.015
        test_admin_can_change_membership_role FAIL
            test score ratio: 6.428571428571429/90
            test time: 0.032
        test_member_cannot_change_membership_role FAIL
            test score ratio: 6.428571428571429/90
            test time: 0.032
        test_owner_can_remove_member PASS
            test score ratio: 6.428571428571429/90
            test time: 0.013
        test_member_cannot_remove_another_member PASS
            test score ratio: 6.428571428571429/90
            test time: 0.023
        test_membership_alias_route_supports_detail_update FAIL
            test score ratio: 6.428571428571429/90
            test time: 0.031
        test_membership_payload_returns_nested_user PASS
            test score ratio: 6.428571428571429/90
            test time: 0.021

membership_notifications 26.666666666666668/80
        test_add_member_creates_notification_for_target_user FAIL
            test score ratio: 26.666666666666668/80
            test time: 0.027
        test_role_change_creates_notification_for_target_user FAIL
            test score ratio: 26.666666666666668/80
            test time: 0.024
        test_remove_member_creates_notification_for_target_user PASS
            test score ratio: 26.666666666666668/80
            test time: 0.014
"""