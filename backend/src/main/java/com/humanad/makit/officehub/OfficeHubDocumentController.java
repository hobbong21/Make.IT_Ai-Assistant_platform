package com.humanad.makit.officehub;

import com.humanad.makit.common.ResourceNotFoundException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/office-hub/documents")
public class OfficeHubDocumentController {

    private final OfficeHubDocumentService service;

    public OfficeHubDocumentController(OfficeHubDocumentService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<OfficeHubDocument> create(@RequestBody DocumentWriteRequest request) {
        OfficeHubDocument created = service.create(request);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<OfficeHubDocument> update(@PathVariable String id,
                                                    @RequestBody DocumentWriteRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OfficeHubDocument> get(@PathVariable String id) {
        return service.find(id)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException("OfficeHubDocument", id));
    }
}
