//
//  Family.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class Family: CustomStringConvertible, Identifiable {
    public var id = UUID()
    
    public var description: String
    
    public var familyName: String
    
    public var points: Int
    
    public init(_ familyName: String) {
        self.familyName = familyName
        self.points = 0
        self.description = self.familyName
    }
    
    public func getName() -> String { return self.familyName }
    
    public func getPoints() -> Int { return self.points }
    
    public func addPoints(amount: Int) { self.points += amount }
    
    public func setPoints(points: Int) { self.points = points }
}
