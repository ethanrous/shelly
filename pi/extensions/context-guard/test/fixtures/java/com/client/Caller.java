package com.client;

import com.ex.DocumentService;
import java.util.function.Function;

public class Caller {
    private final DocumentService svc = new DocumentService(null);

    String run(Request req) {
        String id = svc.getDocumentId(req);
        Function<DocumentService, String> f = DocumentService::getDocumentId;
        return id;
    }
}
