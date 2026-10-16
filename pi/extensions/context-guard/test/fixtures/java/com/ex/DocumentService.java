package com.ex;

import java.util.List;

/**
 * Service for documents.
 */
public class DocumentService extends BaseService implements Svc {
    private final Repo repo;
    static final int LIMIT = 1, OTHER = 2;

    public DocumentService(Repo repo) {
        this.repo = repo;
    }

    /** Returns the id for a request. */
    @Override
    public String getDocumentId(Request r) {
        // getDocumentId is cached
        String label = "getDocumentId";
        return r.id();
    }

    public String getDocumentId() {
        return "none";
    }

    static class Inner {
        void run() {
        }
    }
}
