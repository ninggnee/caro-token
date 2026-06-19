// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title WarehouseDocumentRegistry
 * @notice On-chain registry for compliance-critical warehouse document CIDs.
 *         Non-compliance docs (photos, etc.) are stored off-chain only.
 *
 * Compliance document types recorded on-chain:
 *   warehouse_license | inspection_report | warehouse_certificate
 */
contract WarehouseDocumentRegistry is AccessControl, Pausable {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");

    struct WarehouseDoc {
        uint256 warehouseId;
        string  cid;
        string  documentType;
        string  documentName;
        uint256 timestamp;
        address recordedBy;
        uint256 dbRecordId;
    }

    // warehouseId => list of docs
    mapping(uint256 => WarehouseDoc[]) private _warehouseDocs;

    // cid => true (duplicate prevention)
    mapping(string => bool) private _cidExists;

    // Total documents recorded
    uint256 public totalDocuments;

    event WarehouseDocumentAdded(
        uint256 indexed warehouseId,
        string  cid,
        string  documentType,
        string  documentName,
        uint256 timestamp,
        address indexed recordedBy,
        uint256 indexed dbRecordId
    );

    event WarehouseDocumentRevoked(
        uint256 indexed warehouseId,
        string  cid,
        uint256 timestamp
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RECORDER_ROLE,      admin);
        _grantRole(PAUSER_ROLE,        admin);
    }

    /**
     * @notice Record a compliance document CID on-chain.
     * @param warehouseId   The database warehouse ID.
     * @param cid           IPFS CIDv0 (Qm…) returned by Infura.
     * @param documentType  One of: warehouse_license | inspection_report | warehouse_certificate
     * @param documentName  Human-readable file name.
     * @param dbRecordId    The warehouse_documents.id from the database.
     */
    function addWarehouseDocument(
        uint256 warehouseId,
        string  memory cid,
        string  memory documentType,
        string  memory documentName,
        uint256 dbRecordId
    ) external onlyRole(RECORDER_ROLE) whenNotPaused {
        require(bytes(cid).length > 0,          "CID required");
        require(bytes(documentType).length > 0,  "documentType required");
        require(!_cidExists[cid],                "CID already recorded");

        _cidExists[cid] = true;
        totalDocuments++;

        _warehouseDocs[warehouseId].push(WarehouseDoc({
            warehouseId:  warehouseId,
            cid:          cid,
            documentType: documentType,
            documentName: documentName,
            timestamp:    block.timestamp,
            recordedBy:   msg.sender,
            dbRecordId:   dbRecordId
        }));

        emit WarehouseDocumentAdded(
            warehouseId,
            cid,
            documentType,
            documentName,
            block.timestamp,
            msg.sender,
            dbRecordId
        );
    }

    /**
     * @notice Check whether a CID has already been recorded.
     */
    function cidExists(string memory cid) external view returns (bool) {
        return _cidExists[cid];
    }

    /**
     * @notice Get all documents recorded for a warehouse.
     */
    function getWarehouseDocs(uint256 warehouseId)
        external view returns (WarehouseDoc[] memory)
    {
        return _warehouseDocs[warehouseId];
    }

    /**
     * @notice Count of documents for a warehouse.
     */
    function getWarehouseDocCount(uint256 warehouseId)
        external view returns (uint256)
    {
        return _warehouseDocs[warehouseId].length;
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
