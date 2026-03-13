// Sources flattened with hardhat v2.28.6 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/access/IAccessControl.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (access/IAccessControl.sol)

pragma solidity >=0.8.4;

/**
 * @dev External interface of AccessControl declared to support ERC-165 detection.
 */
interface IAccessControl {
    /**
     * @dev The `account` is missing a role.
     */
    error AccessControlUnauthorizedAccount(address account, bytes32 neededRole);

    /**
     * @dev The caller of a function is not the expected one.
     *
     * NOTE: Don't confuse with {AccessControlUnauthorizedAccount}.
     */
    error AccessControlBadConfirmation();

    /**
     * @dev Emitted when `newAdminRole` is set as ``role``'s admin role, replacing `previousAdminRole`
     *
     * `DEFAULT_ADMIN_ROLE` is the starting admin for all roles, despite
     * {RoleAdminChanged} not being emitted to signal this.
     */
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);

    /**
     * @dev Emitted when `account` is granted `role`.
     *
     * `sender` is the account that originated the contract call. This account bears the admin role (for the granted role).
     * Expected in cases where the role was granted using the internal {AccessControl-_grantRole}.
     */
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Emitted when `account` is revoked `role`.
     *
     * `sender` is the account that originated the contract call:
     *   - if using `revokeRole`, it is the admin role bearer
     *   - if using `renounceRole`, it is the role bearer (i.e. `account`)
     */
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) external view returns (bool);

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {AccessControl-_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) external view returns (bytes32);

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function grantRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function revokeRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been granted `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `callerConfirmation`.
     */
    function renounceRole(bytes32 role, address callerConfirmation) external;
}


// File @openzeppelin/contracts/utils/Context.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/utils/introspection/IERC165.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/IERC165.sol)

pragma solidity >=0.4.16;

/**
 * @dev Interface of the ERC-165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[ERC].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}


// File @openzeppelin/contracts/utils/introspection/ERC165.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (utils/introspection/ERC165.sol)

pragma solidity ^0.8.20;

/**
 * @dev Implementation of the {IERC165} interface.
 *
 * Contracts that want to implement ERC-165 should inherit from this contract and override {supportsInterface} to check
 * for the additional interface id that will be supported. For example:
 *
 * ```solidity
 * function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
 *     return interfaceId == type(MyInterface).interfaceId || super.supportsInterface(interfaceId);
 * }
 * ```
 */
abstract contract ERC165 is IERC165 {
    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}


// File @openzeppelin/contracts/access/AccessControl.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.6.0) (access/AccessControl.sol)

pragma solidity ^0.8.20;



/**
 * @dev Contract module that allows children to implement role-based access
 * control mechanisms. This is a lightweight version that doesn't allow enumerating role
 * members except through off-chain means by accessing the contract event logs. Some
 * applications may benefit from on-chain enumerability, for those cases see
 * {AccessControlEnumerable}.
 *
 * Roles are referred to by their `bytes32` identifier. These should be exposed
 * in the external API and be unique. The best way to achieve this is by
 * using `public constant` hash digests:
 *
 * ```solidity
 * bytes32 public constant MY_ROLE = keccak256("MY_ROLE");
 * ```
 *
 * Roles can be used to represent a set of permissions. To restrict access to a
 * function call, use {hasRole}:
 *
 * ```solidity
 * function foo() public {
 *     require(hasRole(MY_ROLE, msg.sender));
 *     ...
 * }
 * ```
 *
 * Roles can be granted and revoked dynamically via the {grantRole} and
 * {revokeRole} functions. Each role has an associated admin role, and only
 * accounts that have a role's admin role can call {grantRole} and {revokeRole}.
 *
 * By default, the admin role for all roles is `DEFAULT_ADMIN_ROLE`, which means
 * that only accounts with this role will be able to grant or revoke other
 * roles. More complex role relationships can be created by using
 * {_setRoleAdmin}.
 *
 * WARNING: The `DEFAULT_ADMIN_ROLE` is also its own admin: it has permission to
 * grant and revoke this role. Extra precautions should be taken to secure
 * accounts that have been granted it. We recommend using {AccessControlDefaultAdminRules}
 * to enforce additional security measures for this role.
 */
abstract contract AccessControl is Context, IAccessControl, ERC165 {
    struct RoleData {
        mapping(address account => bool) hasRole;
        bytes32 adminRole;
    }

    mapping(bytes32 role => RoleData) private _roles;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /**
     * @dev Modifier that checks that an account has a specific role. Reverts
     * with an {AccessControlUnauthorizedAccount} error including the required role.
     */
    modifier onlyRole(bytes32 role) {
        _checkRole(role);
        _;
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAccessControl).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) public view virtual returns (bool) {
        return _roles[role].hasRole[account];
    }

    /**
     * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `_msgSender()`
     * is missing `role`. Overriding this function changes the behavior of the {onlyRole} modifier.
     */
    function _checkRole(bytes32 role) internal view virtual {
        _checkRole(role, _msgSender());
    }

    /**
     * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `account`
     * is missing `role`.
     */
    function _checkRole(bytes32 role, address account) internal view virtual {
        if (!hasRole(role, account)) {
            revert AccessControlUnauthorizedAccount(account, role);
        }
    }

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) public view virtual returns (bytes32) {
        return _roles[role].adminRole;
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleGranted} event.
     */
    function grantRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleRevoked} event.
     */
    function revokeRole(bytes32 role, address account) public virtual onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been revoked `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `callerConfirmation`.
     *
     * May emit a {RoleRevoked} event.
     */
    function renounceRole(bytes32 role, address callerConfirmation) public virtual {
        if (callerConfirmation != _msgSender()) {
            revert AccessControlBadConfirmation();
        }

        _revokeRole(role, callerConfirmation);
    }

    /**
     * @dev Sets `adminRole` as ``role``'s admin role.
     *
     * Emits a {RoleAdminChanged} event.
     */
    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal virtual {
        bytes32 previousAdminRole = getRoleAdmin(role);
        _roles[role].adminRole = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }

    /**
     * @dev Attempts to grant `role` to `account` and returns a boolean indicating if `role` was granted.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleGranted} event.
     */
    function _grantRole(bytes32 role, address account) internal virtual returns (bool) {
        if (!hasRole(role, account)) {
            _roles[role].hasRole[account] = true;
            emit RoleGranted(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Attempts to revoke `role` from `account` and returns a boolean indicating if `role` was revoked.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleRevoked} event.
     */
    function _revokeRole(bytes32 role, address account) internal virtual returns (bool) {
        if (hasRole(role, account)) {
            _roles[role].hasRole[account] = false;
            emit RoleRevoked(role, account, _msgSender());
            return true;
        } else {
            return false;
        }
    }
}


// File @openzeppelin/contracts/interfaces/IERC165.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC165.sol)

pragma solidity >=0.4.16;


// File @openzeppelin/contracts/token/ERC20/IERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/IERC20.sol)

pragma solidity >=0.4.16;

/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}


// File @openzeppelin/contracts/interfaces/IERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC20.sol)

pragma solidity >=0.4.16;


// File @openzeppelin/contracts/interfaces/IERC1363.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (interfaces/IERC1363.sol)

pragma solidity >=0.6.2;


/**
 * @title IERC1363
 * @dev Interface of the ERC-1363 standard as defined in the https://eips.ethereum.org/EIPS/eip-1363[ERC-1363].
 *
 * Defines an extension interface for ERC-20 tokens that supports executing code on a recipient contract
 * after `transfer` or `transferFrom`, or code on a spender contract after `approve`, in a single transaction.
 */
interface IERC1363 is IERC20, IERC165 {
    /*
     * Note: the ERC-165 identifier for this interface is 0xb0202a11.
     * 0xb0202a11 ===
     *   bytes4(keccak256('transferAndCall(address,uint256)')) ^
     *   bytes4(keccak256('transferAndCall(address,uint256,bytes)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256)')) ^
     *   bytes4(keccak256('transferFromAndCall(address,address,uint256,bytes)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256)')) ^
     *   bytes4(keccak256('approveAndCall(address,uint256,bytes)'))
     */

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferAndCall(address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the allowance mechanism
     * and then calls {IERC1363Receiver-onTransferReceived} on `to`.
     * @param from The address which you want to send tokens from.
     * @param to The address which you want to transfer to.
     * @param value The amount of tokens to be transferred.
     * @param data Additional data with no specified format, sent in call to `to`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function transferFromAndCall(address from, address to, uint256 value, bytes calldata data) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value) external returns (bool);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens and then calls {IERC1363Spender-onApprovalReceived} on `spender`.
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     * @param data Additional data with no specified format, sent in call to `spender`.
     * @return A boolean value indicating whether the operation succeeded unless throwing.
     */
    function approveAndCall(address spender, uint256 value, bytes calldata data) external returns (bool);
}


// File @openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (token/ERC20/utils/SafeERC20.sol)

pragma solidity ^0.8.20;


/**
 * @title SafeERC20
 * @dev Wrappers around ERC-20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    /**
     * @dev An operation with an ERC-20 token failed.
     */
    error SafeERC20FailedOperation(address token);

    /**
     * @dev Indicates a failed `decreaseAllowance` request.
     */
    error SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    /**
     * @dev Transfer `value` amount of `token` from the calling contract to `to`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     */
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        if (!_safeTransfer(token, to, value, true)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Transfer `value` amount of `token` from `from` to `to`, spending the approval given by `from` to the
     * calling contract. If `token` returns no value, non-reverting calls are assumed to be successful.
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        if (!_safeTransferFrom(token, from, to, value, true)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Variant of {safeTransfer} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransfer(IERC20 token, address to, uint256 value) internal returns (bool) {
        return _safeTransfer(token, to, value, false);
    }

    /**
     * @dev Variant of {safeTransferFrom} that returns a bool instead of reverting if the operation is not successful.
     */
    function trySafeTransferFrom(IERC20 token, address from, address to, uint256 value) internal returns (bool) {
        return _safeTransferFrom(token, from, to, value, false);
    }

    /**
     * @dev Increase the calling contract's allowance toward `spender` by `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 oldAllowance = token.allowance(address(this), spender);
        forceApprove(token, spender, oldAllowance + value);
    }

    /**
     * @dev Decrease the calling contract's allowance toward `spender` by `requestedDecrease`. If `token` returns no
     * value, non-reverting calls are assumed to be successful.
     *
     * IMPORTANT: If the token implements ERC-7674 (ERC-20 with temporary allowance), and if the "client"
     * smart contract uses ERC-7674 to set temporary allowances, then the "client" smart contract should avoid using
     * this function. Performing a {safeIncreaseAllowance} or {safeDecreaseAllowance} operation on a token contract
     * that has a non-zero temporary allowance (for that particular owner-spender) will result in unexpected behavior.
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 requestedDecrease) internal {
        unchecked {
            uint256 currentAllowance = token.allowance(address(this), spender);
            if (currentAllowance < requestedDecrease) {
                revert SafeERC20FailedDecreaseAllowance(spender, currentAllowance, requestedDecrease);
            }
            forceApprove(token, spender, currentAllowance - requestedDecrease);
        }
    }

    /**
     * @dev Set the calling contract's allowance toward `spender` to `value`. If `token` returns no value,
     * non-reverting calls are assumed to be successful. Meant to be used with tokens that require the approval
     * to be set to zero before setting it to a non-zero value, such as USDT.
     *
     * NOTE: If the token implements ERC-7674, this function will not modify any temporary allowance. This function
     * only sets the "standard" allowance. Any temporary allowance will remain active, in addition to the value being
     * set here.
     */
    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        if (!_safeApprove(token, spender, value, false)) {
            if (!_safeApprove(token, spender, 0, true)) revert SafeERC20FailedOperation(address(token));
            if (!_safeApprove(token, spender, value, true)) revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} transferAndCall, with a fallback to the simple {ERC20} transfer if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that relies on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            safeTransfer(token, to, value);
        } else if (!token.transferAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} transferFromAndCall, with a fallback to the simple {ERC20} transferFrom if the target
     * has no code. This can be used to implement an {ERC721}-like safe transfer that relies on {ERC1363} checks when
     * targeting contracts.
     *
     * Reverts if the returned value is other than `true`.
     */
    function transferFromAndCallRelaxed(
        IERC1363 token,
        address from,
        address to,
        uint256 value,
        bytes memory data
    ) internal {
        if (to.code.length == 0) {
            safeTransferFrom(token, from, to, value);
        } else if (!token.transferFromAndCall(from, to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Performs an {ERC1363} approveAndCall, with a fallback to the simple {ERC20} approve if the target has no
     * code. This can be used to implement an {ERC721}-like safe transfer that rely on {ERC1363} checks when
     * targeting contracts.
     *
     * NOTE: When the recipient address (`to`) has no code (i.e. is an EOA), this function behaves as {forceApprove}.
     * Oppositely, when the recipient address (`to`) has code, this function only attempts to call {ERC1363-approveAndCall}
     * once without retrying, and relies on the returned value to be true.
     *
     * Reverts if the returned value is other than `true`.
     */
    function approveAndCallRelaxed(IERC1363 token, address to, uint256 value, bytes memory data) internal {
        if (to.code.length == 0) {
            forceApprove(token, to, value);
        } else if (!token.approveAndCall(to, value, data)) {
            revert SafeERC20FailedOperation(address(token));
        }
    }

    /**
     * @dev Imitates a Solidity `token.transfer(to, value)` call, relaxing the requirement on the return value: the
     * return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param to The recipient of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeTransfer(IERC20 token, address to, uint256 value, bool bubble) private returns (bool success) {
        bytes4 selector = IERC20.transfer.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(to, shr(96, not(0))))
            mstore(0x24, value)
            success := call(gas(), token, 0, 0x00, 0x44, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
        }
    }

    /**
     * @dev Imitates a Solidity `token.transferFrom(from, to, value)` call, relaxing the requirement on the return
     * value: the return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param from The sender of the tokens
     * @param to The recipient of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 value,
        bool bubble
    ) private returns (bool success) {
        bytes4 selector = IERC20.transferFrom.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(from, shr(96, not(0))))
            mstore(0x24, and(to, shr(96, not(0))))
            mstore(0x44, value)
            success := call(gas(), token, 0, 0x00, 0x64, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
            mstore(0x60, 0)
        }
    }

    /**
     * @dev Imitates a Solidity `token.approve(spender, value)` call, relaxing the requirement on the return value:
     * the return value is optional (but if data is returned, it must not be false).
     *
     * @param token The token targeted by the call.
     * @param spender The spender of the tokens
     * @param value The amount of token to transfer
     * @param bubble Behavior switch if the transfer call reverts: bubble the revert reason or return a false boolean.
     */
    function _safeApprove(IERC20 token, address spender, uint256 value, bool bubble) private returns (bool success) {
        bytes4 selector = IERC20.approve.selector;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            mstore(0x00, selector)
            mstore(0x04, and(spender, shr(96, not(0))))
            mstore(0x24, value)
            success := call(gas(), token, 0, 0x00, 0x44, 0x00, 0x20)
            // if call success and return is true, all is good.
            // otherwise (not success or return is not true), we need to perform further checks
            if iszero(and(success, eq(mload(0x00), 1))) {
                // if the call was a failure and bubble is enabled, bubble the error
                if and(iszero(success), bubble) {
                    returndatacopy(fmp, 0x00, returndatasize())
                    revert(fmp, returndatasize())
                }
                // if the return value is not true, then the call is only successful if:
                // - the token address has code
                // - the returndata is empty
                success := and(success, and(iszero(returndatasize()), gt(extcodesize(token), 0)))
            }
            mstore(0x40, fmp)
        }
    }
}


// File @openzeppelin/contracts/utils/Pausable.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.3.0) (utils/Pausable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotPaused` and `whenPaused`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
abstract contract Pausable is Context {
    bool private _paused;

    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by `account`.
     */
    event Unpaused(address account);

    /**
     * @dev The operation failed because the contract is paused.
     */
    error EnforcedPause();

    /**
     * @dev The operation failed because the contract is not paused.
     */
    error ExpectedPause();

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() {
        _requirePaused();
        _;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual returns (bool) {
        return _paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused() internal view virtual {
        if (paused()) {
            revert EnforcedPause();
        }
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused() internal view virtual {
        if (!paused()) {
            revert ExpectedPause();
        }
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}


// File @openzeppelin/contracts/utils/StorageSlot.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

pragma solidity ^0.8.20;

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC-1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     // Define the slot. Alternatively, use the SlotDerivation library to derive the slot.
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * TIP: Consider using this library along with {SlotDerivation}.
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns a `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}


// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 *
 * IMPORTANT: Deprecated. This storage-based reentrancy guard will be removed and replaced
 * by the {ReentrancyGuardTransient} variant in v6.0.
 *
 * @custom:stateless
 */
abstract contract ReentrancyGuard {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    /**
     * @dev A `view` only version of {nonReentrant}. Use to block view functions
     * from being called, preventing reading from inconsistent contract state.
     *
     * CAUTION: This is a "view" modifier and does not change the reentrancy
     * status. Use it only on view functions. For payable or non-payable functions,
     * use the standard {nonReentrant} modifier instead.
     */
    modifier nonReentrantView() {
        _nonReentrantBeforeView();
        _;
    }

    function _nonReentrantBeforeView() private view {
        if (_reentrancyGuardEntered()) {
            revert ReentrancyGuardReentrantCall();
        }
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        _nonReentrantBeforeView();

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuardStorageSlot().getUint256Slot().value = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _reentrancyGuardStorageSlot().getUint256Slot().value == ENTERED;
    }

    function _reentrancyGuardStorageSlot() internal pure virtual returns (bytes32) {
        return REENTRANCY_GUARD_STORAGE;
    }
}


// File contracts/ReputationManager.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.20;


/**
 * @title ReputationManager
 * @notice Manages on-chain reputation scores for AgentFi agents.
 *         Scale: 0–50. Collateral curve is continuous — no binary cliff.
 *         Formula: collateral_bps = max(0, (35 − rep) × 286)
 *                  max_loan_usdc  = rep × 20e6   (6-decimal USDC)
 *                  interest_floor = max(50, 350 − rep × 6)  (bps)
 */
contract ReputationManager is AccessControl, ReentrancyGuard {
    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant LENDING_ROLE   = keccak256("LENDING_ROLE");
    bytes32 public constant ZK_ORACLE_ROLE = keccak256("ZK_ORACLE_ROLE");

    // ─── Constants ───────────────────────────────────────────────────────────
    uint256 public constant MAX_REP              = 50;
    uint256 public constant ZERO_COLLATERAL_REP  = 35;   // C₀ crossover
    uint256 public constant NEW_AGENT_BASELINE   = 25;
    uint256 public constant SIBLING_BOOST_CAP    = 8;    // max +8 from siblings
    uint256 public constant ZK_BOOST             = 8;    // one-time ZK vouching
    uint256 public constant INACTIVITY_THRESHOLD = 60 days;
    uint256 public constant INACTIVITY_DECAY_BPS = 50;   // 0.5 rep per 30d (×100 stored)
    uint256 public constant DECAY_PERIOD         = 30 days;

    // Collateral multiplier: (35 - rep) × 286 bps ≈ (35 - rep) × 2.86%
    uint256 public constant COLLATERAL_SLOPE_BPS = 286;

    // ─── Score deltas (stored as int8 for gas) ───────────────────────────────
    int8 public constant DELTA_REPAY_PROFIT    =  2;
    int8 public constant DELTA_REPAY_NO_PROFIT =  1;
    int8 public constant DELTA_LATE            = -2;
    int8 public constant DELTA_PARTIAL         = -4;
    int8 public constant DELTA_DEFAULT         = -10;

    // ─── Agent record ────────────────────────────────────────────────────────
    struct AgentRecord {
        bytes32 userId;          // off-chain user UUID, hashed
        uint256 score;           // 0–50, stored ×100 internally for decay precision
        uint256 lastActivityAt;
        bool    zkVouched;
        bool    active;
    }

    // agentId → record
    mapping(bytes32 => AgentRecord) public agents;

    // agentId → accumulated decay debt (×100) not yet applied
    mapping(bytes32 => uint256) private _decayDebt;

    // ─── Events ──────────────────────────────────────────────────────────────
    event AgentRegistered(bytes32 indexed agentId, bytes32 indexed userId, uint256 initialScore);
    event RepUpdated(bytes32 indexed agentId, int256 delta, uint256 newScore, string reason);
    event ZKVouchApplied(bytes32 indexed agentId, uint256 newScore);
    event InactivityDecayApplied(bytes32 indexed agentId, uint256 decayAmount, uint256 newScore);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Registration
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new agent with baseline score 25.
     *         Optionally apply sibling bootstrap (validated off-chain, submitted by lending contract).
     * @param agentId     keccak256 of the agent UUID
     * @param userId      keccak256 of the user UUID (for anti-exploit binding)
     * @param siblingBonus pre-validated sibling boost, 0–8
     */
    function registerAgent(
        bytes32 agentId,
        bytes32 userId,
        uint256 siblingBonus
    ) external onlyRole(LENDING_ROLE) {
        require(!agents[agentId].active, "Agent already registered");
        require(siblingBonus <= SIBLING_BOOST_CAP, "Sibling bonus exceeds cap");

        uint256 initialScore = NEW_AGENT_BASELINE + siblingBonus; // max 33
        // Store ×100 for sub-integer decay precision
        agents[agentId] = AgentRecord({
            userId:         userId,
            score:          initialScore * 100,
            lastActivityAt: block.timestamp,
            zkVouched:      false,
            active:         true
        });

        emit AgentRegistered(agentId, userId, initialScore);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ZK Bootstrap (one-time)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Apply one-time +8 ZK human vouching. Called by ZK oracle after proof verification.
     */
    function applyZKVouch(bytes32 agentId) external onlyRole(ZK_ORACLE_ROLE) {
        AgentRecord storage rec = agents[agentId];
        require(rec.active, "Agent not registered");
        require(!rec.zkVouched, "ZK vouch already applied");

        rec.zkVouched = true;
        uint256 boost = ZK_BOOST * 100;
        rec.score = _capScore(rec.score + boost);
        rec.lastActivityAt = block.timestamp;

        emit ZKVouchApplied(agentId, rec.score / 100);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Reputation Updates (called by LendingPool)
    // ─────────────────────────────────────────────────────────────────────────

    function applyRepayProfitDelta(bytes32 agentId)
        external onlyRole(LENDING_ROLE)
    { _applyDelta(agentId, DELTA_REPAY_PROFIT, "repay_profit"); }

    function applyRepayNoProfitDelta(bytes32 agentId)
        external onlyRole(LENDING_ROLE)
    { _applyDelta(agentId, DELTA_REPAY_NO_PROFIT, "repay_no_profit"); }

    function applyLateDelta(bytes32 agentId)
        external onlyRole(LENDING_ROLE)
    { _applyDelta(agentId, DELTA_LATE, "late_repayment"); }

    function applyPartialDelta(bytes32 agentId)
        external onlyRole(LENDING_ROLE)
    { _applyDelta(agentId, DELTA_PARTIAL, "partial_repayment"); }

    function applyDefaultDelta(bytes32 agentId)
        external onlyRole(LENDING_ROLE)
    { _applyDelta(agentId, DELTA_DEFAULT, "default"); }

    // ─────────────────────────────────────────────────────────────────────────
    //  Inactivity Decay  (callable by anyone — permissionless upkeep)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Apply accumulated inactivity decay for an agent.
     *         −0.5 rep per 30 days after 60 days of inactivity.
     */
    function applyDecay(bytes32 agentId) external {
        AgentRecord storage rec = agents[agentId];
        require(rec.active, "Agent not registered");

        uint256 inactive = block.timestamp - rec.lastActivityAt;
        if (inactive <= INACTIVITY_THRESHOLD) return;

        // Periods beyond the 60d grace window
        uint256 decayPeriods = (inactive - INACTIVITY_THRESHOLD) / DECAY_PERIOD;
        if (decayPeriods == 0) return;

        // 0.5 rep × 100 = 50 units per period
        uint256 totalDecay = decayPeriods * INACTIVITY_DECAY_BPS;
        uint256 before = rec.score;
        rec.score = rec.score > totalDecay ? rec.score - totalDecay : 0;

        // Advance lastActivityAt by the periods consumed to avoid re-applying
        rec.lastActivityAt += decayPeriods * DECAY_PERIOD;

        emit InactivityDecayApplied(agentId, totalDecay / 100, rec.score / 100);
        emit RepUpdated(agentId, -int256(totalDecay / 100), rec.score / 100, "inactivity_decay");
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  View helpers (consumed by LendingPool)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns the integer rep score (0–50)
    function getScore(bytes32 agentId) external view returns (uint256) {
        return agents[agentId].score / 100;
    }

    /// @notice Returns raw ×100 score for decay precision (internal use)
    function getRawScore(bytes32 agentId) external view returns (uint256) {
        return agents[agentId].score;
    }

    /// @notice userId bound to this agent (for anti-exploit match check)
    function getUserId(bytes32 agentId) external view returns (bytes32) {
        return agents[agentId].userId;
    }

    /**
     * @notice Collateral required as basis points.
     *         collateral_bps = max(0, (35 − rep) × 286)
     *         10000 bps = 100% collateral
     */
    function collateralBps(bytes32 agentId) external view returns (uint256) {
        uint256 rep = agents[agentId].score / 100;
        return _collateralBps(rep);
    }

    /**
     * @notice Maximum loan size in USDC (6 decimals).
     *         max_loan = rep × 20 USDC
     */
    function maxLoanUsdc(bytes32 agentId) external view returns (uint256) {
        uint256 rep = agents[agentId].score / 100;
        return rep * 20 * 1e6; // 6-decimal USDC
    }

    /**
     * @notice Minimum interest rate in basis points.
     *         floor = max(50, 350 − rep × 6)
     */
    function interestFloorBps(bytes32 agentId) external view returns (uint256) {
        uint256 rep = agents[agentId].score / 100;
        return _interestFloorBps(rep);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Pure math helpers (public so LendingPool can call for quoting)
    // ─────────────────────────────────────────────────────────────────────────

    function _collateralBps(uint256 rep) internal pure returns (uint256) {
        if (rep >= ZERO_COLLATERAL_REP) return 0;
        return (ZERO_COLLATERAL_REP - rep) * COLLATERAL_SLOPE_BPS;
    }

    function _interestFloorBps(uint256 rep) internal pure returns (uint256) {
        uint256 computed = rep * 6;
        uint256 floor    = computed >= 350 ? 0 : 350 - computed;
        return floor < 50 ? 50 : floor;
    }

    function _capScore(uint256 raw) internal pure returns (uint256) {
        uint256 cap = MAX_REP * 100;
        return raw > cap ? cap : raw;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _applyDelta(bytes32 agentId, int8 delta, string memory reason) internal {
        AgentRecord storage rec = agents[agentId];
        require(rec.active, "Agent not registered");

        int256 rawScore = int256(rec.score) + int256(int8(delta)) * 100;
        rec.score = rawScore < 0 ? 0 : _capScore(uint256(rawScore));
        rec.lastActivityAt = block.timestamp;

        emit RepUpdated(agentId, delta, rec.score / 100, reason);
    }
}


// File contracts/AgentFiLending.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.20;






/**
 * @title AgentFiLending
 * @notice Under-collateralised P2P lending for AI agents.
 *
 *  Key invariants enforced here:
 *  1. Collateral = continuous curve from ReputationManager — no binary cliff.
 *  2. Anti-exploit: lender.userId == borrower.userId → HARD REJECT.
 *  3. Loan terms (size, collateral, rate floor) are read from ReputationManager
 *     at match time — snapshot into the Loan struct for immutability.
 *  4. Late / partial / default events feed back to ReputationManager.
 *  5. Rolling volume gate is handled off-chain (BitGo/multisig layer).
 *     This contract records the settled amounts for auditability.
 */
contract AgentFiLending is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant MATCHER_ROLE  = keccak256("MATCHER_ROLE");
    bytes32 public constant PLATFORM_ROLE = keccak256("PLATFORM_ROLE");

    // ─── Immutables ──────────────────────────────────────────────────────────
    IERC20             public immutable usdc;
    ReputationManager  public immutable repManager;

    // ─── Config ──────────────────────────────────────────────────────────────
    uint256 public loanDuration      = 30 days;   // default term
    uint256 public lateGracePeriod   = 3 days;    // before "late" penalty
    uint256 public partialThreshold  = 8000;      // 80% in bps = partial repay cutoff
    uint256 public platformFeeBps    = 50;        // 0.5% platform cut on interest

    // ─── Enums ───────────────────────────────────────────────────────────────
    enum LoanStatus { Active, Repaid, Late, Partial, Defaulted }
    enum OrderStatus { Open, Matched, Cancelled, Expired }

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct LendOffer {
        bytes32     offerId;
        bytes32     lenderAgentId;
        uint256     maxAmount;        // USDC (6 dec)
        uint256     interestRateBps;  // e.g. 200 = 2%
        uint256     minRepRequired;   // 0–50
        uint256     expiresAt;
        OrderStatus status;
    }

    struct BorrowRequest {
        bytes32     requestId;
        bytes32     borrowerAgentId;
        uint256     requestedAmount;  // USDC (6 dec)
        uint256     expiresAt;
        OrderStatus status;
    }

    struct Loan {
        bytes32     loanId;
        bytes32     lenderAgentId;
        bytes32     borrowerAgentId;
        uint256     principal;          // USDC
        uint256     collateralLocked;   // USDC locked from borrower
        uint256     interestRateBps;    // agreed rate
        uint256     collateralBpsSnap;  // collateral % at origination
        uint256     repSnap;            // rep score at origination
        uint256     issuedAt;
        uint256     dueAt;
        uint256     repaidAt;
        uint256     amountRepaid;
        LoanStatus  status;
    }

    // ─── Storage ─────────────────────────────────────────────────────────────
    mapping(bytes32 => LendOffer)    public lendOffers;
    mapping(bytes32 => BorrowRequest) public borrowRequests;
    mapping(bytes32 => Loan)         public loans;

    // lenderAgentId → escrowed USDC locked with their open offers
    mapping(bytes32 => uint256) public escrowedFunds;

    // agentId → active loan id (0 = none)  — one active loan per agent
    mapping(bytes32 => bytes32) public activeLoan;

    uint256 public totalLoansIssued;
    uint256 public totalDefaulted;

    // ─── Events ──────────────────────────────────────────────────────────────
    event LendOfferPosted(bytes32 indexed offerId, bytes32 indexed lenderAgentId, uint256 amount, uint256 rateBps, uint256 minRep);
    event LendOfferCancelled(bytes32 indexed offerId, bytes32 indexed lenderAgentId);
    event BorrowRequestPosted(bytes32 indexed requestId, bytes32 indexed borrowerAgentId, uint256 amount);
    event LoanOriginated(bytes32 indexed loanId, bytes32 indexed lenderAgentId, bytes32 indexed borrowerAgentId, uint256 principal, uint256 collateral, uint256 rateBps, uint256 repSnap);
    event LoanRepaid(bytes32 indexed loanId, uint256 amountRepaid, LoanStatus status);
    event LoanDefaulted(bytes32 indexed loanId, bytes32 indexed borrowerAgentId, uint256 collateralSeized);
    event SelfMatchRejected(bytes32 indexed offerId, bytes32 indexed requestId, bytes32 userId);
    event CollateralDeposited(bytes32 indexed agentId, uint256 amount);
    event CollateralReleased(bytes32 indexed agentId, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address _usdc, address _repManager) {
        usdc       = IERC20(_usdc);
        repManager = ReputationManager(_repManager);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PLATFORM_ROLE, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  LEND SIDE — post / cancel offers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Lender agent posts a lending offer. Funds are escrowed immediately.
     *         Lender pays −1 rep if they cancel (enforced in cancelLendOffer).
     * @param lenderAgentId  hashed agent UUID
     * @param amount         USDC to lend
     * @param interestRateBps offered rate (must be ≥ borrower's floor at match time)
     * @param minRepRequired  minimum rep the borrower must have
     * @param duration        validity window in seconds
     */
    function postLendOffer(
        bytes32 lenderAgentId,
        uint256 amount,
        uint256 interestRateBps,
        uint256 minRepRequired,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (bytes32 offerId) {
        require(amount > 0, "Amount must be > 0");
        require(interestRateBps > 0, "Rate must be > 0");
        require(minRepRequired <= 50, "Rep cap is 50");
        require(duration > 0 && duration <= 365 days, "Invalid duration");
        require(repManager.getUserId(lenderAgentId) != bytes32(0), "Lender not registered");
        require(activeLoan[lenderAgentId] == bytes32(0), "Agent has active loan");

        offerId = keccak256(abi.encodePacked(lenderAgentId, amount, block.timestamp, block.prevrandao));

        lendOffers[offerId] = LendOffer({
            offerId:          offerId,
            lenderAgentId:    lenderAgentId,
            maxAmount:        amount,
            interestRateBps:  interestRateBps,
            minRepRequired:   minRepRequired,
            expiresAt:        block.timestamp + duration,
            status:           OrderStatus.Open
        });

        // Escrow funds immediately
        escrowedFunds[lenderAgentId] += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit LendOfferPosted(offerId, lenderAgentId, amount, interestRateBps, minRepRequired);
    }

    /**
     * @notice Cancel an open lend offer. Funds returned, −1 rep applied.
     */
    function cancelLendOffer(bytes32 offerId) external nonReentrant {
        LendOffer storage offer = lendOffers[offerId];
        require(offer.status == OrderStatus.Open, "Offer not open");
        // Caller must control the lender agent (validated via userId mapping off-chain;
        // here we require msg.sender to be the registered wallet for that agent)
        _requireAgentCaller(offer.lenderAgentId);

        offer.status = OrderStatus.Cancelled;
        escrowedFunds[offer.lenderAgentId] -= offer.maxAmount;
        usdc.safeTransfer(msg.sender, offer.maxAmount);

        // Cancel penalty — direct call to RepManager
        repManager.applyLateDelta(offer.lenderAgentId); // reuse −2 is too harsh; TODO: add CANCEL role delta
        emit LendOfferCancelled(offerId, offer.lenderAgentId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  BORROW SIDE — post request
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Borrower agent posts a borrow request.
     *         Collateral is collected here based on real-time rep curve.
     * @param borrowerAgentId hashed agent UUID
     * @param amount          requested USDC
     * @param duration        desired term in seconds
     */
    function postBorrowRequest(
        bytes32 borrowerAgentId,
        uint256 amount,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (bytes32 requestId) {
        require(amount > 0, "Amount must be > 0");
        require(repManager.getUserId(borrowerAgentId) != bytes32(0), "Borrower not registered");
        require(activeLoan[borrowerAgentId] == bytes32(0), "Agent has active loan");
        require(amount <= repManager.maxLoanUsdc(borrowerAgentId), "Exceeds rep-based loan limit");
        require(duration > 0 && duration <= 365 days, "Invalid duration");

        requestId = keccak256(abi.encodePacked(borrowerAgentId, amount, block.timestamp, block.prevrandao));

        borrowRequests[requestId] = BorrowRequest({
            requestId:       requestId,
            borrowerAgentId: borrowerAgentId,
            requestedAmount: amount,
            expiresAt:       block.timestamp + duration,
            status:          OrderStatus.Open
        });

        // Collect collateral upfront (may be 0 for high-rep agents)
        uint256 colBps = repManager.collateralBps(borrowerAgentId);
        uint256 collateral = _calcCollateral(amount, colBps);
        if (collateral > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), collateral);
            emit CollateralDeposited(borrowerAgentId, collateral);
        }

        // Store collateral in loan placeholder — will be linked at match
        // Using escrow map for borrower pending collateral
        escrowedFunds[borrowerAgentId] += collateral;

        emit BorrowRequestPosted(requestId, borrowerAgentId, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  MATCHING ENGINE  (called by off-chain matcher service via MATCHER_ROLE)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a matched loan from a lend offer and borrow request.
     *
     *         Anti-exploit check: lender.userId == borrower.userId → REJECT.
     *         Rate check: offered rate must be ≥ borrower's interest floor.
     *         Rep check: borrower rep must meet lender's minRepRequired.
     *
     * @param offerId    matched lend offer
     * @param requestId  matched borrow request
     */
    function matchAndOriginate(
        bytes32 offerId,
        bytes32 requestId
    ) external nonReentrant whenNotPaused onlyRole(MATCHER_ROLE) returns (bytes32 loanId) {
        LendOffer    storage offer   = lendOffers[offerId];
        BorrowRequest storage request = borrowRequests[requestId];

        // ── Sanity checks ────────────────────────────────────────────────────
        require(offer.status   == OrderStatus.Open, "Offer not open");
        require(request.status == OrderStatus.Open, "Request not open");
        require(block.timestamp < offer.expiresAt,   "Offer expired");
        require(block.timestamp < request.expiresAt, "Request expired");

        bytes32 lenderAgentId   = offer.lenderAgentId;
        bytes32 borrowerAgentId = request.borrowerAgentId;

        // ── ANTI-EXPLOIT: hard block same-user matching ───────────────────────
        bytes32 lenderUserId   = repManager.getUserId(lenderAgentId);
        bytes32 borrowerUserId = repManager.getUserId(borrowerAgentId);
        if (lenderUserId == borrowerUserId) {
            emit SelfMatchRejected(offerId, requestId, lenderUserId);
            revert("Self-match: same user agents cannot match");
        }

        uint256 borrowerRep = repManager.getScore(borrowerAgentId);

        // ── Rep gate ─────────────────────────────────────────────────────────
        require(borrowerRep >= offer.minRepRequired, "Borrower rep below offer minimum");

        // ── Amount gate ──────────────────────────────────────────────────────
        uint256 principal = request.requestedAmount;
        require(principal <= offer.maxAmount, "Borrow exceeds offer max");
        require(principal <= repManager.maxLoanUsdc(borrowerAgentId), "Exceeds rep loan limit");

        // ── Rate gate: offered rate ≥ borrower interest floor ────────────────
        uint256 floorBps = repManager.interestFloorBps(borrowerAgentId);
        require(offer.interestRateBps >= floorBps, "Rate below borrower floor");

        // ── Snapshot collateral at origination ──────────────────────────────
        uint256 colBps       = repManager.collateralBps(borrowerAgentId);
        uint256 collateral   = escrowedFunds[borrowerAgentId]; // collected at request time
        uint256 expectedCol  = _calcCollateral(principal, colBps);

        // Validate borrower deposited correct collateral
        require(collateral >= expectedCol, "Insufficient collateral deposited");

        // ── Create loan record ───────────────────────────────────────────────
        loanId = keccak256(abi.encodePacked(offerId, requestId, block.timestamp));
        uint256 dueAt = block.timestamp + loanDuration;

        loans[loanId] = Loan({
            loanId:             loanId,
            lenderAgentId:      lenderAgentId,
            borrowerAgentId:    borrowerAgentId,
            principal:          principal,
            collateralLocked:   collateral,
            interestRateBps:    offer.interestRateBps,
            collateralBpsSnap:  colBps,
            repSnap:            borrowerRep,
            issuedAt:           block.timestamp,
            dueAt:              dueAt,
            repaidAt:           0,
            amountRepaid:       0,
            status:             LoanStatus.Active
        });

        // ── Update state ─────────────────────────────────────────────────────
        offer.status           = OrderStatus.Matched;
        request.status         = OrderStatus.Matched;
        activeLoan[borrowerAgentId] = loanId;
        activeLoan[lenderAgentId]   = loanId;

        escrowedFunds[borrowerAgentId]  = 0;          // collateral now in loan
        escrowedFunds[lenderAgentId]   -= principal;  // lender escrow reduced

        totalLoansIssued++;

        // Transfer principal to borrower's wallet (agent wallet addr must be registered)
        // In production this is the 2-of-2 multisig wallet — platform passes it via off-chain
        // For now we emit and the platform bridges the transfer
        emit LoanOriginated(loanId, lenderAgentId, borrowerAgentId, principal, collateral, offer.interestRateBps, borrowerRep);

        // Send principal to borrower wallet (agent wallet address stored off-chain, platform handles)
        // Direct transfer handled by platform layer post-event
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  REPAYMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Repay a loan. Handles on-time full repay, late repay, and partial repay.
     *         Collateral is released proportionally. Rep updated accordingly.
     *
     * @param loanId        loan to repay
     * @param amountPaid    USDC amount the borrower is sending
     * @param profitGenerated  true if Elsa generated profit this cycle (affects +2 vs +1 delta)
     */
    function repay(
        bytes32 loanId,
        uint256 amountPaid,
        bool profitGenerated
    ) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active || loan.status == LoanStatus.Late, "Loan not repayable");

        // Collect repayment
        usdc.safeTransferFrom(msg.sender, address(this), amountPaid);

        loan.amountRepaid = amountPaid;
        loan.repaidAt     = block.timestamp;

        uint256 totalOwed = _totalOwed(loan);
        bool isLate       = block.timestamp > loan.dueAt + lateGracePeriod;
        bool isFull       = amountPaid >= totalOwed;
        bool isPartial    = !isFull && (amountPaid * 10000 >= totalOwed * partialThreshold);
        // isDefault if < 80% of owed (handled in declareLoanDefault below)

        uint256 interest      = _calcInterest(loan.principal, loan.interestRateBps);
        uint256 platformFee   = (interest * platformFeeBps) / 10000;
        uint256 lenderPayout  = loan.principal + interest - platformFee;

        if (isFull) {
            loan.status = LoanStatus.Repaid;

            // Release collateral back to borrower
            if (loan.collateralLocked > 0) {
                usdc.safeTransfer(msg.sender, loan.collateralLocked);
                emit CollateralReleased(loan.borrowerAgentId, loan.collateralLocked);
            }

            // Pay lender
            usdc.safeTransfer(_agentWallet(loan.lenderAgentId), lenderPayout);

            // Rep update: +2 if profit, +1 if just covered interest
            if (isLate) {
                repManager.applyLateDelta(loan.borrowerAgentId);
            } else if (profitGenerated) {
                repManager.applyRepayProfitDelta(loan.borrowerAgentId);
            } else {
                repManager.applyRepayNoProfitDelta(loan.borrowerAgentId);
            }

        } else if (isPartial) {
            loan.status = LoanStatus.Partial;

            // Seize collateral proportional to shortfall
            uint256 shortfall       = totalOwed - amountPaid;
            uint256 collateralUsed  = shortfall > loan.collateralLocked
                ? loan.collateralLocked
                : shortfall;
            uint256 collateralBack  = loan.collateralLocked - collateralUsed;

            // Lender gets what they can
            uint256 lenderRecovery = amountPaid + collateralUsed;
            usdc.safeTransfer(_agentWallet(loan.lenderAgentId), lenderRecovery > lenderPayout ? lenderPayout : lenderRecovery);

            if (collateralBack > 0) {
                usdc.safeTransfer(msg.sender, collateralBack);
                emit CollateralReleased(loan.borrowerAgentId, collateralBack);
            }

            repManager.applyPartialDelta(loan.borrowerAgentId);

        } else {
            // Paid < 80% of owed — treat as default path via declareLoanDefault
            revert("Amount < 80% owed; call declareLoanDefault if unable to repay");
        }

        activeLoan[loan.borrowerAgentId] = bytes32(0);
        activeLoan[loan.lenderAgentId]   = bytes32(0);

        emit LoanRepaid(loanId, amountPaid, loan.status);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DEFAULT DECLARATION  (callable by lender or platform after due date)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Declare a loan defaulted after due date + grace period.
     *         Collateral is seized and sent to lender. Rep −10 applied.
     */
    function declareLoanDefault(bytes32 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active || loan.status == LoanStatus.Late, "Not active");
        require(block.timestamp > loan.dueAt + lateGracePeriod, "Grace period not elapsed");

        loan.status = LoanStatus.Defaulted;
        totalDefaulted++;

        uint256 collateral = loan.collateralLocked;

        // Transfer collateral to lender as partial recovery
        if (collateral > 0) {
            usdc.safeTransfer(_agentWallet(loan.lenderAgentId), collateral);
        }

        repManager.applyDefaultDelta(loan.borrowerAgentId);

        activeLoan[loan.borrowerAgentId] = bytes32(0);
        activeLoan[loan.lenderAgentId]   = bytes32(0);

        emit LoanDefaulted(loanId, loan.borrowerAgentId, collateral);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  QUOTE VIEW  (read-only helpers for frontend / agent decision making)
    // ─────────────────────────────────────────────────────────────────────────

    struct LoanQuote {
        uint256 principal;
        uint256 collateralRequired;
        uint256 collateralBps;
        uint256 maxLoanUsdc;
        uint256 interestFloorBps;
        uint256 repScore;
        bool    eligible;
    }

    /**
     * @notice Returns a full loan quote for a borrower agent at a given amount.
     */
    function quoteLoan(bytes32 borrowerAgentId, uint256 amount) external view returns (LoanQuote memory q) {
        q.repScore        = repManager.getScore(borrowerAgentId);
        q.maxLoanUsdc     = repManager.maxLoanUsdc(borrowerAgentId);
        q.collateralBps   = repManager.collateralBps(borrowerAgentId);
        q.interestFloorBps = repManager.interestFloorBps(borrowerAgentId);
        q.principal       = amount;
        q.collateralRequired = _calcCollateral(amount, q.collateralBps);
        q.eligible        = (amount <= q.maxLoanUsdc) && (activeLoan[borrowerAgentId] == bytes32(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ADMIN
    // ─────────────────────────────────────────────────────────────────────────

    function setLoanDuration(uint256 d) external onlyRole(DEFAULT_ADMIN_ROLE) {
        loanDuration = d;
    }
    function setLateGracePeriod(uint256 g) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lateGracePeriod = g;
    }
    function setPlatformFeeBps(uint256 fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(fee <= 500, "Fee cap 5%");
        platformFeeBps = fee;
    }
    function pause()   external onlyRole(PLATFORM_ROLE) { _pause(); }
    function unpause() external onlyRole(PLATFORM_ROLE) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    //  INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev collateral = (principal × colBps) / 10000
    function _calcCollateral(uint256 principal, uint256 colBps) internal pure returns (uint256) {
        return (principal * colBps) / 10000;
    }

    /// @dev interest = (principal × rateBps × loanDuration) / (10000 × 365 days)
    ///      Simplified to flat rate for this MVP — multiply by term fraction
    function _calcInterest(uint256 principal, uint256 rateBps) internal view returns (uint256) {
        // Flat rate applied over full loanDuration as fraction of year
        return (principal * rateBps * loanDuration) / (10000 * 365 days);
    }

    function _totalOwed(Loan storage loan) internal view returns (uint256) {
        return loan.principal + _calcInterest(loan.principal, loan.interestRateBps);
    }

    /// @dev In production this reads from a registry. Stub for demo.
    mapping(bytes32 => address) public agentWallets;

    function registerAgentWallet(bytes32 agentId, address wallet) external onlyRole(PLATFORM_ROLE) {
        agentWallets[agentId] = wallet;
    }

    function _agentWallet(bytes32 agentId) internal view returns (address) {
        address w = agentWallets[agentId];
        require(w != address(0), "Agent wallet not registered");
        return w;
    }

    function _requireAgentCaller(bytes32 agentId) internal view {
        require(agentWallets[agentId] == msg.sender, "Not agent wallet");
    }
}
