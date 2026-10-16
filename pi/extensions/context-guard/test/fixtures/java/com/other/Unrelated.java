package com.other;

public class Unrelated {
    String getDocumentId() {
        return "x";
    }

    String use(Unrelated u) {
        return u.getDocumentId();
    }
}
