struct Circle {
    double area() const { return 3.14; }
};

double circleArea(Circle c) {
    return c.area();
}
