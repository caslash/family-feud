//
//  State.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class State<T: CustomStringConvertible>: CustomStringConvertible {
    public var description: String
    
    private var name: String
    
    private var nextStateString: String?
    
    internal var data: Any?
    
    private var type: T
    
    public init(type: T) {
        self.name = type.description
        self.type = type
        self.description = self.name
    }
    
    public func getName() -> String { return name }
    
    public func getType() -> T { return type }
    
    public func executeAction(action: Int, data: [Any]) -> Bool { return false }
    
    public func initState(data: Any) { fatalError("initState(data:) has not been implemented") }
    
    public func updateState(timeElapsed: Float) { fatalError("updateState(timeElapsed:) has not been implemented") }
    
    public func cleanupState() { fatalError("cleanupState() has not been implemented") }
    
    public func nextState() -> String? { return self.nextStateString }
    
    public func canAdvance(nextState: String) -> Bool { return true }
    
    public func setNextState(state: String) { self.nextStateString = state }
    
    public func getData() -> Any? { return self.data }
}
