//
//  StateStart.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class StateStart: FFState {
    internal init() {
        super.init(type: FFStateType.START)
    }
    
    public override func initState(data: Any) { }
    
    public override func updateState(timeElapsed: Float) { }
    
    public override func cleanupState() { }
}
