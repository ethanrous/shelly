#pragma once

namespace geo {

// A shape with an area.
class Shape {
public:
    Shape();
    virtual double area() const;
    int sides_;
};

struct Point {
    int x;
};

double distance(Point a, Point b);

typedef int Id;
using Size = long;

template <typename T>
T clampv(T v);

}  // namespace geo
