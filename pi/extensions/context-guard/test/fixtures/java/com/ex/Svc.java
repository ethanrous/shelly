package com.ex;

public interface Svc {
    default String getDocumentId() {
        return "svc";
    }
}
