//
//  FamilyCollection.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class FamilyCollection {
    private var families: [Family]
    
    public init() {
        self.families = [Family]()
    }
    
    public func addFamily(familyName: String) { families.append(Family(familyName)) }
    
    public func getFamily(familyName: String) -> Family? {
        return families.first(where: { $0.getName().caseInsensitiveCompare(familyName) == .orderedSame })
    }
    
    public func getFamily(index: Int) -> Family { return families[index] }
    
    public func removeFamily(index: Int) { families.remove(at: index) }
    
    public func getFamilies() -> [Family] { return self.families }
    
    public func size() -> Int { return self.families.count }
    
    public func reset() { self.families = [Family]() }
}
